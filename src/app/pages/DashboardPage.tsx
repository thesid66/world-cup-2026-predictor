import { useMemo } from 'react'
import { MatchScoreCard } from '../../components/groups/MatchScoreCard'
import { useTournamentData } from '../../context/TournamentDataContext'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import type { Fixture } from '../../types/tournament'

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

export function DashboardPage() {
  const scores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, groups, fixtures } = useTournamentData()

  const completedMatches = fixtures.filter((fixture) => isFixtureScoreCompleted(fixture.id, scores)).length
  const groupStageFixtures = fixtures.filter((fixture) => fixture.stage === 'group')
  const nextFixture = useMemo(() => getNextFixture(groupStageFixtures), [groupStageFixtures])

  const liveFixture = groupStageFixtures.find((fixture) => {
    const realMatch = realMatches[fixture.id]
    const status = `${realMatch?.status.short ?? ''} ${realMatch?.status.long ?? ''}`.toLowerCase()

    return status.includes('live')
  })

  const featuredFixture = liveFixture ?? nextFixture
  const featuredHomeTeam = teams.find((team) => team.id === featuredFixture?.homeTeamId)
  const featuredAwayTeam = teams.find((team) => team.id === featuredFixture?.awayTeamId)

  return (
    <div className="grid gap-6">
      <section id="dashboard" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-400">Teams loaded</p>
          <p className="mt-2 text-4xl font-black text-white">{teams.length}</p>
          <p className="mt-2 text-sm text-slate-300">All World Cup teams are ready.</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-400">Groups loaded</p>
          <p className="mt-2 text-4xl font-black text-white">{groups.length}</p>
          <p className="mt-2 text-sm text-slate-300">Group A to Group L are ready.</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-400">Fixtures loaded</p>
          <p className="mt-2 text-4xl font-black text-white">{fixtures.length}</p>
          <p className="mt-2 text-sm text-slate-300">Full group-stage fixture data is ready.</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-400">Scores entered</p>
          <p className="mt-2 text-4xl font-black text-white">{completedMatches}</p>
          <p className="mt-2 text-sm text-slate-300">Scores save to your account after login.</p>
        </article>
      </section>

      <section className="rounded-4xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-5">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            {liveFixture ? 'Live now' : 'Next match'}
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            {liveFixture ? 'Live match centre' : 'Upcoming fixture'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {liveFixture
              ? 'A loaded SportScore match is currently marked live. Open the card for timeline, score and match details.'
              : 'No live SportScore match is currently loaded. The next scheduled fixture is shown below.'}
          </p>
        </div>

        {featuredFixture ? (
          <MatchScoreCard
            fixture={featuredFixture}
            homeTeam={featuredHomeTeam}
            awayTeam={featuredAwayTeam}
            highlighted={Boolean(liveFixture)}
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
