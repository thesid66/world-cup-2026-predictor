import { useEffect, useMemo } from 'react'
import { MatchScoreCard } from '../../components/groups/MatchScoreCard'
import { useTournamentData } from '../../context/TournamentDataContext'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import type { RealMatchData } from '../../types/realMatch'
import type { Fixture } from '../../types/tournament'

const MATCH_LIVE_LOOKUP_WINDOW_MS = 3 * 60 * 60 * 1000

function isFixtureScoreCompleted(
  fixtureId: string,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixtureId]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function getFixtureSlotKey(fixture: Fixture) {
  const normalizedTimeSlot = fixture.kickoffTimeSort || fixture.kickoffTime

  if (fixture.date && normalizedTimeSlot) {
    return `${fixture.date}|${normalizedTimeSlot}`
  }

  const kickoffDate = getFixtureKickoffDate(fixture)

  return kickoffDate ? String(kickoffDate.getTime()) : null
}

function getDatedFixtures(fixtures: Fixture[]) {
  return fixtures
    .map((fixture) => ({ fixture, kickoffDate: getFixtureKickoffDate(fixture) }))
    .filter(
      (entry): entry is { fixture: Fixture; kickoffDate: Date } =>
        entry.kickoffDate instanceof Date
    )
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())
}

function getNextFixture(fixtures: Fixture[]) {
  const now = Date.now()
  const datedFixtures = getDatedFixtures(fixtures)

  return datedFixtures.find((entry) => entry.kickoffDate.getTime() >= now)?.fixture ?? null
}

function getFixturesInSameSlot(fixtures: Fixture[], selectedFixture: Fixture | null) {
  if (!selectedFixture) {
    return []
  }

  const selectedSlotKey = getFixtureSlotKey(selectedFixture)

  if (!selectedSlotKey) {
    return [selectedFixture]
  }

  const matchingFixtures = fixtures.filter((fixture) => getFixtureSlotKey(fixture) === selectedSlotKey)
  const sortedFixtures = getDatedFixtures(matchingFixtures).map((entry) => entry.fixture)

  return sortedFixtures.length ? sortedFixtures : matchingFixtures
}

function getRealMatchStatusText(realMatch?: RealMatchData) {
  return `${realMatch?.status.short ?? ''} ${realMatch?.status.long ?? ''}`.toLowerCase()
}

function isCompletedRealMatch(realMatch?: RealMatchData) {
  const status = getRealMatchStatusText(realMatch)

  return (
    status.includes('ft') ||
    status.includes('full time') ||
    status.includes('full-time') ||
    status.includes('final') ||
    status.includes('postponed') ||
    status.includes('abandoned')
  )
}

function isLiveRealMatch(realMatch?: RealMatchData) {
  if (!realMatch || isCompletedRealMatch(realMatch)) {
    return false
  }

  const status = getRealMatchStatusText(realMatch)

  return (
    status.includes('live') ||
    status.includes('half') ||
    status.includes('break') ||
    status.includes('progress') ||
    status.includes('in play') ||
    status.includes('1st') ||
    status.includes('2nd') ||
    status.includes('first') ||
    status.includes('second') ||
    typeof realMatch.status.elapsed === 'number'
  )
}

function isLikelyLiveFixture(fixture: Fixture, realMatch?: RealMatchData) {
  if (realMatch && isCompletedRealMatch(realMatch)) {
    return false
  }

  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!kickoffDate) {
    return false
  }

  const elapsedSinceKickoff = Date.now() - kickoffDate.getTime()

  return elapsedSinceKickoff >= 0 && elapsedSinceKickoff <= MATCH_LIVE_LOOKUP_WINDOW_MS
}

export function DashboardPage() {
  const scores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, groups, fixtures } = useTournamentData()

  const completedMatches = fixtures.filter((fixture) => isFixtureScoreCompleted(fixture.id, scores)).length
  const groupStageFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.stage === 'group'),
    [fixtures]
  )
  const nextFixture = useMemo(() => getNextFixture(groupStageFixtures), [groupStageFixtures])
  const nextFixtureSlot = useMemo(
    () => getFixturesInSameSlot(groupStageFixtures, nextFixture),
    [groupStageFixtures, nextFixture]
  )

  const liveFixtures = useMemo(
    () =>
      groupStageFixtures.filter(
        (fixture) =>
          isLiveRealMatch(realMatches[fixture.id]) ||
          isLikelyLiveFixture(fixture, realMatches[fixture.id])
      ),
    [groupStageFixtures, realMatches]
  )

  useEffect(() => {
    if (liveFixtures.length === 0) {
      return undefined
    }

    function fetchLiveMatches() {
      const latestState = useRealMatchStore.getState()

      liveFixtures.forEach((fixture) => {
        const latestRealMatch = latestState.matches[fixture.id]

        if (latestState.loading[fixture.id]) {
          return
        }

        if (
          latestRealMatch &&
          !isLiveRealMatch(latestRealMatch) &&
          !isLikelyLiveFixture(fixture, latestRealMatch)
        ) {
          return
        }

        void latestState.fetchMatchData(fixture, true, { silent: true })
      })
    }

    fetchLiveMatches()

    const intervalId = window.setInterval(fetchLiveMatches, 1000)

    return () => window.clearInterval(intervalId)
  }, [liveFixtures])

  const featuredFixtures = liveFixtures.length > 0 ? liveFixtures : nextFixtureSlot
  const hasMultipleLiveFixtures = liveFixtures.length > 1
  const hasMultipleScheduledFixtures = liveFixtures.length === 0 && featuredFixtures.length > 1

  return (
    <div className="grid gap-5 sm:gap-6">
      <section id="dashboard" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Teams loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{teams.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">All World Cup teams are ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Groups loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{groups.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Group A to Group L are ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Fixtures loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{fixtures.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Full group-stage fixture data is ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Scores entered</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{completedMatches}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Scores save to your account after login.</p>
        </article>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:rounded-4xl sm:p-5">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300 sm:text-sm sm:tracking-[0.3em]">
            {liveFixtures.length > 0 ? 'Live now' : hasMultipleScheduledFixtures ? 'Next match slot' : 'Next match'}
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white">
            {hasMultipleLiveFixtures
              ? 'Live matches centre'
              : liveFixtures.length === 1
                ? 'Live match centre'
                : hasMultipleScheduledFixtures
                  ? 'Upcoming fixtures'
                  : 'Upcoming fixture'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {hasMultipleLiveFixtures
              ? 'Multiple ESPN matches are currently in progress. Open each card for live score, timeline and match details.'
              : liveFixtures.length === 1
                ? 'An ESPN match is currently in progress. Open the card for live score, timeline and match details.'
                : hasMultipleScheduledFixtures
                  ? 'Multiple fixtures share the next scheduled kickoff slot, so they are shown together with live kickoff countdowns.'
                  : 'No unfinished live ESPN match is currently loaded. The next scheduled fixture is shown below with a live kickoff countdown.'}
          </p>
        </div>

        {featuredFixtures.length > 0 ? (
          <div className={featuredFixtures.length > 1 ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-3'}>
            {featuredFixtures.map((fixture) => {
              const homeTeam = teams.find((team) => team.id === fixture.homeTeamId)
              const awayTeam = teams.find((team) => team.id === fixture.awayTeamId)
              const isLiveFixture = liveFixtures.some((liveFixture) => liveFixture.id === fixture.id)

              return (
                <MatchScoreCard
                  key={fixture.id}
                  fixture={fixture}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  highlighted={isLiveFixture}
                  showCountdown
                  hideLoadRealDataButton
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm font-bold text-slate-300">
            No fixture is available to feature yet.
          </div>
        )}
      </section>
    </div>
  )
}
