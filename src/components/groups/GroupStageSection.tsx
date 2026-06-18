import { useEffect, useMemo, useState } from 'react'
import { useTournamentData } from '../../context/TournamentDataContext'
import { canFetchSportScoreMatchData } from '../../services/sportScore'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { RealMatchData } from '../../types/realMatch'
import type { Fixture, PredictionScore } from '../../types/tournament'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import { MatchScoreCard } from './MatchScoreCard'

const JUMP_BUTTON_AUTO_HIDE_MS = 7000

function isFixtureCompleted(
  fixture: Fixture,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
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

  if (dateCompare !== 0) {
    return dateCompare
  }

  const aSortTime = a.kickoffTimeSort ?? ''
  const bSortTime = b.kickoffTimeSort ?? ''

  if (aSortTime && bSortTime) {
    const timeCompare = aSortTime.localeCompare(bSortTime)

    if (timeCompare !== 0) {
      return timeCompare
    }
  }

  return a.matchNumber - b.matchNumber
}

function getFixtureElementId(fixtureId: string) {
  return `fixture-${fixtureId}`
}

function isElementVisibleEnough(element: HTMLElement, minimumVisibleRatio = 0.45) {
  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)

  if (visibleHeight <= 0) {
    return false
  }

  return visibleHeight / Math.max(rect.height, 1) >= minimumVisibleRatio
}

function getNextMatchFixture(fixtures: Fixture[]) {
  const now = Date.now()

  const datedFixtures = fixtures
    .map((fixture) => ({
      fixture,
      kickoffDate: getFixtureKickoffDate(fixture)
    }))
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
  const [isJumpButtonVisible, setIsJumpButtonVisible] = useState(true)
  const [isLoadingActualScores, setIsLoadingActualScores] = useState(false)
  const [actualScoreLoadSummary, setActualScoreLoadSummary] = useState<string | null>(null)

  const scores = usePredictionStore((state) => state.scores)
  const replaceScores = usePredictionStore((state) => state.replaceScores)
  const resetPredictions = usePredictionStore((state) => state.resetPredictions)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const { fixtures, teams } = useTournamentData()

  const groupStageFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.stage === 'group').sort(sortFixturesByDateAndTime),
    [fixtures]
  )

  const nextMatchFixture = useMemo(
    () => getNextMatchFixture(groupStageFixtures),
    [groupStageFixtures]
  )

  const hasSportScoreFixtures = groupStageFixtures.some(canFetchSportScoreMatchData)

  async function loadActualScores() {
    if (isLoadingActualScores || !hasSportScoreFixtures) {
      return
    }

    setIsLoadingActualScores(true)
    setActualScoreLoadSummary('Loading actual scores...')

    let loadedCount = 0
    let unavailableCount = 0

    for (const fixture of groupStageFixtures) {
      if (!canFetchSportScoreMatchData(fixture)) {
        unavailableCount += 1
        continue
      }

      setActualScoreLoadSummary(
        `Loading actual scores... ${loadedCount} loaded · ${unavailableCount} unavailable · checking match ${fixture.matchNumber}`
      )

      try {
        await fetchMatchData(fixture, true)
      } catch {
        unavailableCount += 1
        setActualScoreLoadSummary(
          `Loading actual scores... ${loadedCount} loaded · ${unavailableCount} unavailable`
        )
        continue
      }

      const matchData = useRealMatchStore.getState().matches[fixture.id]

      if (!hasUsableActualScore(matchData)) {
        unavailableCount += 1
        setActualScoreLoadSummary(
          `Loading actual scores... ${loadedCount} loaded · ${unavailableCount} unavailable`
        )
        continue
      }

      const currentScores = usePredictionStore.getState().scores
      const currentScore = currentScores[fixture.id]

      replaceScores({
        ...currentScores,
        [fixture.id]: {
          ...currentScore,
          ...buildActualScore(matchData)
        }
      })

      loadedCount += 1
      setActualScoreLoadSummary(
        `Loading actual scores... ${loadedCount} loaded · ${unavailableCount} unavailable`
      )
    }

    const summaryParts = [`${loadedCount} loaded`]

    if (unavailableCount > 0) {
      summaryParts.push(`${unavailableCount} unavailable`)
    }

    setActualScoreLoadSummary(`Actual scores: ${summaryParts.join(' · ')}.`)
    setIsLoadingActualScores(false)
  }

  useEffect(() => {
    if (!nextMatchFixture) {
      return
    }

    setIsJumpButtonVisible(true)
  }, [nextMatchFixture?.id])

  useEffect(() => {
    if (!nextMatchFixture || !isJumpButtonVisible) {
      return
    }

    const autoHideTimer = window.setTimeout(() => {
      setIsJumpButtonVisible(false)
    }, JUMP_BUTTON_AUTO_HIDE_MS)

    return () => {
      window.clearTimeout(autoHideTimer)
    }
  }, [isJumpButtonVisible, nextMatchFixture?.id])

  useEffect(() => {
    if (!nextMatchFixture) {
      return
    }

    const nextMatchElement = document.getElementById(getFixtureElementId(nextMatchFixture.id))

    if (!nextMatchElement) {
      return
    }

    const nextMatchTarget: HTMLElement = nextMatchElement

    function updateJumpButtonFromElementPosition() {
      setIsJumpButtonVisible(!isElementVisibleEnough(nextMatchTarget))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const hasReachedNextMatch = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45
        )

        setIsJumpButtonVisible(!hasReachedNextMatch)
      },
      {
        threshold: [0, 0.15, 0.45, 0.6]
      }
    )

    observer.observe(nextMatchTarget)

    let scrollTimeout: number | undefined

    function handleScrollOrResize() {
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout)
      }

      scrollTimeout = window.setTimeout(() => {
        updateJumpButtonFromElementPosition()
      }, 120)
    }

    window.addEventListener('scroll', handleScrollOrResize, { passive: true })
    window.addEventListener('resize', handleScrollOrResize)

    updateJumpButtonFromElementPosition()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScrollOrResize)
      window.removeEventListener('resize', handleScrollOrResize)

      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout)
      }
    }
  }, [nextMatchFixture])

  function handleJumpToNextMatch() {
    if (!nextMatchFixture) {
      return
    }

    const nextMatchElement = document.getElementById(getFixtureElementId(nextMatchFixture.id))

    nextMatchElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })

    setIsJumpButtonVisible(false)
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
    <section id="fixtures" className="mt-6 scroll-mt-6">
      <div className="mb-6 overflow-hidden rounded-4xl border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-linear-to-r from-yellow-300/10 via-sky-400/10 to-emerald-300/10" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-300">
                Group stage
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Group-stage fixtures
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Enter scores or load real match data. Scores update group standings, third-place
                ranking and knockout qualification automatically.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <button
                type="button"
                disabled={isLoadingActualScores || !hasSportScoreFixtures}
                onClick={() => void loadActualScores()}
                className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              >
                {isLoadingActualScores ? 'Loading actual scores...' : 'Load actual Score'}
              </button>

              <button
                type="button"
                onClick={resetPredictions}
                className="rounded-2xl border border-red-300/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:-translate-y-0.5 hover:bg-red-400/20"
              >
                Reset all scores
              </button>
            </div>
          </div>

          {actualScoreLoadSummary && (
            <p className="relative mt-4 text-right text-xs font-bold text-emerald-100">
              {actualScoreLoadSummary}
            </p>
          )}

          <div className="relative mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-slate-500">
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

      <div className="rounded-4xl border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">
              Match flow
            </p>

            <h3 className="mt-1 text-2xl font-black text-white">All group-stage fixtures</h3>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">
            Sorted by date and time
          </span>
        </div>

        <div className="grid gap-4">
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

      {nextMatchFixture && isJumpButtonVisible && (
        <button
          type="button"
          onClick={handleJumpToNextMatch}
          className="fixed right-3 top-3 z-50 inline-flex items-center gap-2 rounded-full border border-yellow-200/40 bg-slate-950/95 px-3 py-2 text-left shadow-xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-yellow-200 hover:bg-slate-900 sm:right-6 sm:top-6 sm:px-4"
        >
          <span className="text-xs font-black uppercase tracking-[0.16em] text-yellow-200">
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
