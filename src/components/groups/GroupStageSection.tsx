import { useMemo, useState } from 'react'
import { useTournamentData } from '../../context/TournamentDataContext'
import { canFetchEspnWorldCupMatchData } from '../../services/espnWorldCup'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { RealMatchData } from '../../types/realMatch'
import type { Fixture, PredictionScore } from '../../types/tournament'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import { MatchScoreCard } from './MatchScoreCard'

function isFixtureCompleted(
  fixture: Fixture,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function hasFixtureStarted(fixture: Fixture) {
  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!(kickoffDate instanceof Date)) {
    return false
  }

  return kickoffDate.getTime() <= Date.now()
}

function shouldAttemptActualScoreLoad(
  fixture: Fixture,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  return (
    canFetchEspnWorldCupMatchData(fixture) &&
    hasFixtureStarted(fixture) &&
    !isFixtureCompleted(fixture, scores)
  )
}

function hasUsableActualScore(matchData?: RealMatchData) {
  return typeof matchData?.score.home === 'number' && typeof matchData.score.away === 'number'
}

function buildActualScore(matchData: RealMatchData): PredictionScore {
  return {
    homeScore: matchData.score.home,
    awayScore: matchData.score.away
  }
}

function sortFixturesByDateAndTime(a: Fixture, b: Fixture) {
  const dateCompare = a.date.localeCompare(b.date)

  if (dateCompare !== 0) return dateCompare

  const aSortTime = a.kickoffTimeSort ?? ''
  const bSortTime = b.kickoffTimeSort ?? ''

  if (aSortTime && bSortTime) {
    const timeCompare = aSortTime.localeCompare(bSortTime)

    if (timeCompare !== 0) return timeCompare
  }

  return a.matchNumber - b.matchNumber
}

function getFixtureElementId(fixtureId: string) {
  return `fixture-${fixtureId}`
}

function getNextMatchFixture(fixtures: Fixture[]) {
  const now = Date.now()

  const datedFixtures = fixtures
    .map((fixture) => ({ fixture, kickoffDate: getFixtureKickoffDate(fixture) }))
    .filter(
      (entry): entry is { fixture: Fixture; kickoffDate: Date } =>
        entry.kickoffDate instanceof Date
    )

  const nextUpcomingFixture = datedFixtures.find(
    (entry) => entry.kickoffDate.getTime() >= now
  )

  return nextUpcomingFixture?.fixture ?? datedFixtures.at(-1)?.fixture ?? fixtures[0] ?? null
}

export function GroupStageSection() {
  const [highlightedFixtureId, setHighlightedFixtureId] = useState<string | null>(null)
  const [isLoadingActualScores, setIsLoadingActualScores] = useState(false)
  const [actualScoreLoadSummary, setActualScoreLoadSummary] = useState<string | null>(null)

  const scores = usePredictionStore((state) => state.scores)
  const replaceScores = usePredictionStore((state) => state.replaceScores)
  const resetPredictions = usePredictionStore((state) => state.resetPredictions)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const clearRealMatchCache = useRealMatchStore((state) => state.clearRealMatchCache)
  const { fixtures, teams } = useTournamentData()

  const groupStageFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.stage === 'group').sort(sortFixturesByDateAndTime),
    [fixtures]
  )

  const nextMatchFixture = useMemo(
    () => getNextMatchFixture(groupStageFixtures),
    [groupStageFixtures]
  )

  const hasEspnFixtures = groupStageFixtures.some(canFetchEspnWorldCupMatchData)

  async function loadActualScores() {
    if (isLoadingActualScores || !hasEspnFixtures) return

    setIsLoadingActualScores(true)
    setActualScoreLoadSummary('Loading actual scores...')

    let loadedCount = 0
    let unavailableCount = 0
    let skippedCount = 0
    let futureCount = 0

    for (const fixture of groupStageFixtures) {
      const latestScores = usePredictionStore.getState().scores

      if (isFixtureCompleted(fixture, latestScores)) {
        skippedCount += 1
        setActualScoreLoadSummary(
          `Loading actual scores... ${loadedCount} loaded · ${skippedCount} skipped · ${futureCount} future · ${unavailableCount} unavailable`
        )
        continue
      }

      if (!hasFixtureStarted(fixture)) {
        futureCount += 1
        setActualScoreLoadSummary(
          `Loading actual scores... ${loadedCount} loaded · ${skippedCount} skipped · ${futureCount} future · ${unavailableCount} unavailable`
        )
        continue
      }

      if (!canFetchEspnWorldCupMatchData(fixture)) {
        unavailableCount += 1
        continue
      }

      setActualScoreLoadSummary(
        `Loading actual scores... ${loadedCount} loaded · ${skippedCount} skipped · ${futureCount} future · ${unavailableCount} unavailable · checking match ${fixture.matchNumber}`
      )

      try {
        await fetchMatchData(fixture, true)
      } catch {
        unavailableCount += 1
        continue
      }

      const matchData = useRealMatchStore.getState().matches[fixture.id]

      if (!hasUsableActualScore(matchData)) {
        unavailableCount += 1
        continue
      }

      const currentScores = usePredictionStore.getState().scores
      const currentScore = currentScores[fixture.id]

      if (isFixtureCompleted(fixture, currentScores)) {
        skippedCount += 1
        continue
      }

      replaceScores({
        ...currentScores,
        [fixture.id]: {
          ...currentScore,
          ...buildActualScore(matchData)
        }
      })

      loadedCount += 1
      setActualScoreLoadSummary(
        `Loading actual scores... ${loadedCount} loaded · ${skippedCount} skipped · ${futureCount} future · ${unavailableCount} unavailable`
      )
    }

    const remainingLoadableFixtures = groupStageFixtures.filter((fixture) =>
      shouldAttemptActualScoreLoad(fixture, usePredictionStore.getState().scores)
    )

    setIsLoadingActualScores(false)

    if (remainingLoadableFixtures.length === 0) {
      setActualScoreLoadSummary(null)
      return
    }

    const summaryParts = [`${loadedCount} loaded`]

    if (skippedCount > 0) {
      summaryParts.push(`${skippedCount} skipped`)
    }

    if (futureCount > 0) {
      summaryParts.push(`${futureCount} future`)
    }

    if (unavailableCount > 0) {
      summaryParts.push(`${unavailableCount} unavailable`)
    }

    setActualScoreLoadSummary(`Actual scores: ${summaryParts.join(' · ')}.`)
  }

  function handleResetAllScores() {
    resetPredictions()
    clearRealMatchCache()
    setActualScoreLoadSummary(null)
    setHighlightedFixtureId(null)
  }

  function handleJumpToNextMatch() {
    if (!nextMatchFixture) return

    document.getElementById(getFixtureElementId(nextMatchFixture.id))?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })

    setHighlightedFixtureId(nextMatchFixture.id)

    window.setTimeout(() => {
      setHighlightedFixtureId((currentFixtureId) =>
        currentFixtureId === nextMatchFixture.id ? null : currentFixtureId
      )
    }, 2400)
  }

  const completedMatches = groupStageFixtures.filter((fixture) =>
    isFixtureCompleted(fixture, scores)
  ).length

  const totalMatches = groupStageFixtures.length
  const progress = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

  return (
    <section id="fixtures" className="mt-4 scroll-mt-4 sm:mt-6 sm:scroll-mt-6">
      <div className="mb-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-4xl">
        <div className="relative p-4 sm:p-6">
          <div className="absolute inset-0 bg-linear-to-r from-yellow-300/10 via-sky-400/10 to-emerald-300/10" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-300 sm:text-sm sm:tracking-[0.35em]">
                Group stage
              </p>

              <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                Group-stage fixtures
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Enter scores or load real match data. Scores update group standings, third-place
                ranking and knockout qualification automatically.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[22rem] lg:justify-end">
              <button
                type="button"
                disabled={isLoadingActualScores || !hasEspnFixtures}
                onClick={() => void loadActualScores()}
                className="min-h-11 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              >
                {isLoadingActualScores ? 'Loading actual scores...' : 'Load actual Score'}
              </button>

              <button
                type="button"
                onClick={handleResetAllScores}
                className="min-h-11 rounded-2xl border border-red-300/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:-translate-y-0.5 hover:bg-red-400/20"
              >
                Reset all scores
              </button>
            </div>
          </div>

          {actualScoreLoadSummary && (
            <p className="relative mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-center text-xs font-bold leading-5 text-emerald-100 sm:text-right">
              {actualScoreLoadSummary}
            </p>
          )}

          <div className="relative mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
                <span>Overall group-stage progress</span>
                <span>{progress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-yellow-300 via-sky-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Scores entered
              </p>

              <p className="mt-1 text-3xl font-black text-white">
                {completedMatches}/{totalMatches}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-3 shadow-2xl backdrop-blur-xl sm:rounded-4xl sm:p-5">
        <div className="mb-5 min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300 sm:tracking-[0.25em]">
            Match flow
          </p>

          <h3 className="mt-1 text-2xl font-black leading-tight text-white">All group-stage fixtures</h3>
        </div>

        <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groupStageFixtures.map((fixture) => {
            const homeTeam = teams.find((team) => team.id === fixture.homeTeamId)
            const awayTeam = teams.find((team) => team.id === fixture.awayTeamId)

            return (
              <MatchScoreCard
                key={fixture.id}
                fixture={fixture}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                domId={getFixtureElementId(fixture.id)}
                highlighted={highlightedFixtureId === fixture.id}
              />
            )
          })}
        </div>
      </div>

      {nextMatchFixture && (
        <button
          type="button"
          onClick={handleJumpToNextMatch}
          className="fixed right-3 top-[4.75rem] z-50 inline-flex min-h-10 items-center gap-2 rounded-full border border-yellow-200/40 bg-slate-950/95 px-3 py-2 text-left shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-yellow-200 hover:bg-slate-900 sm:right-6 sm:top-20 sm:px-4"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200 sm:text-xs sm:tracking-[0.16em]">
            Next match
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black text-white">
            #{nextMatchFixture.matchNumber}
          </span>
        </button>
      )}
    </section>
  )
}
