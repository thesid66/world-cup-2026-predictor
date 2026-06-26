import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { calculateThirdPlaceRanking } from '../../logic/thirdPlaceRanking'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { TeamFlag } from '../ui/TeamFlag'

type QualificationStatus = 'qualified' | 'waiting' | 'eliminated'

type ThirdPlaceMiniStatProps = {
  label: string
  value: number
}

function ThirdPlaceMiniStat({ label, value }: ThirdPlaceMiniStatProps) {
  return (
    <div className="rounded-xl bg-white/6 px-2 py-2 text-center ring-1 ring-white/8">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function getQualificationLabel(status: QualificationStatus) {
  if (status === 'qualified') return 'Round of 32'
  if (status === 'eliminated') return 'Eliminated'

  return 'Waiting'
}

function getQualificationClassName(status: QualificationStatus) {
  if (status === 'qualified') {
    return 'bg-emerald-300/15 text-emerald-200 ring-1 ring-emerald-300/30'
  }

  if (status === 'eliminated') {
    return 'bg-red-300/10 text-red-200 ring-1 ring-red-300/20'
  }

  return 'bg-yellow-300/10 text-yellow-200 ring-1 ring-yellow-300/20'
}

export function ThirdPlaceRanking() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, groups, fixtures } = useTournamentData()
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)
  const rows = calculateThirdPlaceRanking(scores, { groups, teams, fixtures })

  const qualifiedCount = rows.filter((row) => row.qualificationStatus === 'qualified').length

  const completeGroups = rows.filter((row) => row.isGroupComplete).length

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-300 sm:text-sm sm:tracking-[0.3em]">
            Qualification race
          </p>

          <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
            Best third-placed teams
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            The top 8 third-placed teams qualify for the Round of 32. Completed groups are now
            mathematically locked when no more than seven other third-place teams can finish above
            them.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-80">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-center sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 sm:text-xs sm:tracking-[0.2em]">
              Qualifying
            </p>
            <p className="mt-1 text-3xl font-black text-white">{qualifiedCount}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 p-3 text-center sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">
              Complete groups
            </p>
            <p className="mt-1 text-3xl font-black text-white">{completeGroups}/12</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:hidden">
        {rows.map((row, index) => {
          const isQualified = row.qualificationStatus === 'qualified'
          const isEliminated = row.qualificationStatus === 'eliminated'
          const qualificationLabel = getQualificationLabel(row.qualificationStatus)
          const qualificationClassName = getQualificationClassName(row.qualificationStatus)

          return (
            <article
              key={`${row.group}-${row.teamId}`}
              className={`rounded-2xl border p-3 ${
                isQualified
                  ? 'border-emerald-300/20 bg-emerald-300/10'
                  : isEliminated
                    ? 'border-red-300/20 bg-red-300/10'
                    : 'border-white/10 bg-slate-950/45'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      isQualified ? 'bg-emerald-300 text-emerald-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {index + 1}
                  </span>

                  <TeamFlag code={row.flagCode} label={row.teamName} />

                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{row.teamName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-bold text-slate-500">{row.shortName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          row.isGroupComplete ? 'bg-emerald-300/15 text-emerald-200' : 'bg-yellow-300/15 text-yellow-200'
                        }`}
                      >
                        Group {row.group} · {row.isGroupComplete ? 'Complete' : 'Provisional'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200">Pts</p>
                  <p className="text-lg font-black text-yellow-300">{row.points}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-6 gap-2">
                <ThirdPlaceMiniStat label="P" value={row.played} />
                <ThirdPlaceMiniStat label="W" value={row.won} />
                <ThirdPlaceMiniStat label="D" value={row.drawn} />
                <ThirdPlaceMiniStat label="L" value={row.lost} />
                <ThirdPlaceMiniStat label="GF" value={row.goalsFor} />
                <ThirdPlaceMiniStat label="GD" value={row.goalDifference} />
              </div>

              <p
                className={`mt-3 rounded-full px-3 py-2 text-center text-xs font-black ${qualificationClassName}`}
              >
                {qualificationLabel}
              </p>
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
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
              const qualificationLabel = getQualificationLabel(row.qualificationStatus)
              const qualificationClassName = getQualificationClassName(row.qualificationStatus)

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
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${qualificationClassName}`}
                    >
                      {qualificationLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
        Note: fair play and FIFA ranking tie-breakers are not included yet because the app currently
        only collects match scores. Equal known points, goal difference and goals scored are treated
        conservatively until the group stage is complete.
      </p>
    </section>
  )
}
