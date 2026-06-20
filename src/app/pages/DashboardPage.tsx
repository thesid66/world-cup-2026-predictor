import { useEffect, useMemo } from 'react'
import { MatchScoreCard } from '../../components/groups/MatchScoreCard'
import { useTournamentData } from '../../context/TournamentDataContext'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import type { RealMatchData } from '../../types/realMatch'
import type { Fixture } from '../../types/tournament'

const MATCH_LIVE_LOOKUP_WINDOW_MS = 3 * 60 * 60 * 1000
const LIVE_MATCH_AUTO_REFRESH_MS = 15 * 1000

function isFixtureScoreCompleted(
  fixtureId: string,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixtureId]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function getNextFixture(fixtures: Fixture[]) {
  const now = Date.now()

  const datedFixtures = fixtures
    .map((fixture) => ({ fixture, kickoffDate: getFixtureKickoffDate(fixture) }))
    .filter(
      (entry): entry is { fixture: Fixture; kickoffDate: Date } =>
        entry.kickoffDate instanceof Date
    )
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())

  return datedFixtures.find((entry) => entry.kickoffDate.getTime() >= now)?.fixture ?? null
}

function getFixtureKickoffTime(fixture: Fixture) {
  return getFixtureKickoffDate(fixture)?.getTime() ?? null
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

function isLikelyLiveFixture(fixture: Fixture, realMatch?: RealMatchData, now = Date.now()) {
  if (realMatch && isCompletedRealMatch(realMatch)) {
    return false
  }

  const kickoffTime = getFixtureKickoffTime(fixture)

  if (!kickoffTime) {
    return false
  }

  const elapsedSinceKickoff = now - kickoffTime

  return elapsedSinceKickoff >= 0 && elapsedSinceKickoff <= MATCH_LIVE_LOOKUP_WINDOW_MS
}

function getLatestMatchingFixture(
  fixtures: Fixture[],
  predicate: (fixture: Fixture) => boolean
) {
  return fixtures
    .map((fixture) => ({ fixture, kickoffTime: getFixtureKickoffTime(fixture) }))
    .filter(
      (entry): entry is { fixture: Fixture; kickoffTime: number } =>
        typeof entry.kickoffTime === 'number' && predicate(entry.fixture)
    )
    .sort((a, b) => b.kickoffTime - a.kickoffTime)[0]?.fixture ?? null
}

export function DashboardPage() {
  const scores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, groups, fixtures } = useTournamentData()

  const completedMatches = fixtures.filter((fixture) => isFixtureScoreCompleted(fixture.id, scores)).length
  const groupStageFixtures = fixtures.filter((fixture) => fixture.stage === 'group')
  const nextFixture = useMemo(() => getNextFixture(groupStageFixtures), [groupStageFixtures])

  const loadedLiveFixture = getLatestMatchingFixture(
    groupStageFixtures,
    (fixture) => isLiveRealMatch(realMatches[fixture.id])
  )
  const likelyLiveFixture = getLatestMatchingFixture(
    groupStageFixtures,
    (fixture) => isLikelyLiveFixture(fixture, realMatches[fixture.id])
  )
  const liveFixture = loadedLiveFixture ?? likelyLiveFixture
  const liveMatch = liveFixture ? realMatches[liveFixture.id] : undefined

  useEffect(() => {
    if (!liveFixture) {
      return undefined
    }

    const refreshLiveFixture = () => {
      const latestState = useRealMatchStore.getState()
      const latestRealMatch = latestState.matches[liveFixture.id]

      if (latestState.loading[liveFixture.id]) {
        return
      }

      if (latestRealMatch && !isLiveRealMatch(latestRealMatch) && !isLikelyLiveFixture(liveFixture, latestRealMatch)) {
        return
      }

      void latestState.fetchMatchData(liveFixture, true, { silent: true })
    }

    refreshLiveFixture()
    const intervalId = window.setInterval(refreshLiveFixture, LIVE_MATCH_AUTO_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [liveFixture])

  const featuredFixture = liveFixture ?? nextFixture
  const featuredHomeTeam = teams.find((team) => team.id === featuredFixture?.homeTeamId)
  const featuredAwayTeam = teams.find((team) => team.id === featuredFixture?.awayTeamId)
  const liveStatusLabel = liveMatch?.status.short || liveMatch?.status.long || 'Live lookup active'
  const liveScoreLabel = liveMatch?.score.display

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

      <section
        className={`rounded-[1.6rem] border p-4 shadow-2xl backdrop-blur-xl sm:rounded-4xl sm:p-5 ${
          liveFixture
            ? 'live-golden-shadow border-yellow-200/60 bg-yellow-300/10'
            : 'border-white/10 bg-white/8'
        }`}
      >
        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.24em] sm:text-sm sm:tracking-[0.3em] ${liveFixture ? 'text-yellow-200' : 'text-emerald-300'}`}>
              {liveFixture ? 'Live now' : 'Next match'}
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-white">
              {liveFixture ? 'Live match centre' : 'Upcoming fixture'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {liveFixture
                ? 'This dashboard is watching the most recent live match window and refreshing ESPN data while the fixture remains in progress.'
                : 'No live ESPN match is currently loaded. The next scheduled fixture is shown below with a kickoff countdown.'}
            </p>
          </div>

          {liveFixture && (
            <div className="rounded-2xl border border-yellow-200/30 bg-slate-950/50 p-3 text-left shadow-xl sm:min-w-[15rem]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">Live status</span>
              </div>
              <p className="mt-2 text-xl font-black text-white">{liveScoreLabel ?? 'Loading score...'}</p>
              <p className="mt-1 text-xs font-bold text-yellow-100">{liveStatusLabel}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Auto-refreshing silently
              </p>
            </div>
          )}
        </div>

        {featuredFixture ? (
          <MatchScoreCard
            fixture={featuredFixture}
            homeTeam={featuredHomeTeam}
            awayTeam={featuredAwayTeam}
            highlighted={Boolean(liveFixture)}
            showCountdown
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm font-bold text-slate-300">
            No fixture is available to feature yet.
          </div>
        )}
      </section>
    </div>
  )
}
