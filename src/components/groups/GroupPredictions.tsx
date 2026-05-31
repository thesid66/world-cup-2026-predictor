import { fixtures } from '../../data/fixtures'
import { teams } from '../../data/teams'
import type { Fixture, GroupCode } from '../../types/tournament'
import { MatchScoreCard } from './MatchScoreCard'

type GroupPredictionsProps = {
  groupCode: GroupCode
}

function groupFixturesByDate(groupFixtures: Fixture[]) {
  return groupFixtures.reduce<Record<string, Fixture[]>>((grouped, fixture) => {
    grouped[fixture.date] ??= []
    grouped[fixture.date].push(fixture)

    return grouped
  }, {})
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`))
}

export function GroupPredictions({ groupCode }: GroupPredictionsProps) {
  const groupFixtures = fixtures
    .filter((fixture) => fixture.stage === 'group' && fixture.group === groupCode)
    .sort((a, b) => a.matchNumber - b.matchNumber)

  const groupedFixtures = groupFixturesByDate(groupFixtures)

  if (groupFixtures.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/30 p-5 text-sm font-bold text-slate-400">
        Fixtures for this group will be added soon.
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">Predictions</p>

          <h4 className="mt-1 text-xl font-black text-white">Match score input</h4>
        </div>

        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">
          {groupFixtures.length} matches
        </span>
      </div>

      <div className="grid gap-5">
        {Object.entries(groupedFixtures).map(([date, dateFixtures]) => (
          <div key={date}>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />

              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black text-slate-400">
                {formatDate(date)}
              </span>

              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-3">
              {dateFixtures.map((fixture) => {
                const homeTeam = teams.find((team) => team.id === fixture.homeTeamId)

                const awayTeam = teams.find((team) => team.id === fixture.awayTeamId)

                return (
                  <MatchScoreCard
                    key={fixture.id}
                    fixture={fixture}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
