import { calculateThirdPlaceRanking } from '../../logic/thirdPlaceRanking'
import { usePredictionStore } from '../../store/predictionStore'
import { TeamFlag } from '../ui/TeamFlag'

export function ThirdPlaceRanking() {
  const scores = usePredictionStore((state) => state.scores)
  const rows = calculateThirdPlaceRanking(scores)

  const qualifiedCount = rows.filter((row) => row.qualificationStatus === 'qualified').length

  const completeGroups = rows.filter((row) => row.isGroupComplete).length

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-yellow-300">
            Qualification race
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">Best third-placed teams</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            The top 8 third-placed teams qualify for the Round of 32. Ranking is currently based on
            points, goal difference, then goals scored.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-80">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              Qualifying
            </p>
            <p className="mt-1 text-3xl font-black text-white">{qualifiedCount}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Complete groups
            </p>
            <p className="mt-1 text-3xl font-black text-white">{completeGroups}/12</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-white/10 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3">Group</th>
              <th className="px-2 py-3 text-center">P</th>
              <th className="px-2 py-3 text-center">W</th>
              <th className="px-2 py-3 text-center">D</th>
              <th className="px-2 py-3 text-center">L</th>
              <th className="px-2 py-3 text-center">GF</th>
              <th className="px-2 py-3 text-center">GA</th>
              <th className="px-2 py-3 text-center">GD</th>
              <th className="px-3 py-3 text-center">Pts</th>
              <th className="px-3 py-3 text-right">Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const isQualified = row.qualificationStatus === 'qualified'

              return (
                <tr
                  key={`${row.group}-${row.teamId}`}
                  className={`border-t border-white/10 ${
                    isQualified ? 'bg-emerald-300/8' : 'bg-slate-950/30'
                  }`}
                >
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                        isQualified
                          ? 'bg-emerald-300 text-emerald-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <TeamFlag code={row.flagCode} label={row.teamName} />

                      <div>
                        <p className="font-black text-white">{row.teamName}</p>
                        <p className="text-xs font-bold text-slate-500">{row.shortName}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <div>
                      <p className="font-black text-slate-200">Group {row.group}</p>
                      <p
                        className={`text-xs font-black ${
                          row.isGroupComplete ? 'text-emerald-300' : 'text-yellow-300'
                        }`}
                      >
                        {row.isGroupComplete ? 'Complete' : 'Provisional'}
                      </p>
                    </div>
                  </td>

                  <td className="px-2 py-3 text-center font-bold text-slate-300">{row.played}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">{row.won}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">{row.drawn}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">{row.lost}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">{row.goalsFor}</td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">
                    {row.goalsAgainst}
                  </td>
                  <td className="px-2 py-3 text-center font-bold text-slate-300">
                    {row.goalDifference}
                  </td>
                  <td className="px-3 py-3 text-center text-lg font-black text-yellow-300">
                    {row.points}
                  </td>

                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        isQualified
                          ? 'bg-emerald-300/15 text-emerald-200 ring-1 ring-emerald-300/30'
                          : 'bg-red-300/10 text-red-200 ring-1 ring-red-300/20'
                      }`}
                    >
                      {isQualified ? 'Round of 32' : 'Eliminated'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
        Note: until every group is completed, this table is provisional. Fair play and FIFA ranking
        tie-breakers are not included yet because the app currently only collects match scores.
      </p>
    </section>
  )
}
