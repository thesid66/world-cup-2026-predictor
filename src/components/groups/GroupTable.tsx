import type { GroupTableRow } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type GroupTableProps = {
  rows: GroupTableRow[]
}

function getRankStyle(index: number) {
  if (index <= 1) {
    return 'bg-emerald-300 text-emerald-950'
  }

  if (index === 2) {
    return 'bg-yellow-300 text-yellow-950'
  }

  return 'bg-red-300/20 text-red-200'
}

function getStatusLabel(index: number) {
  if (index <= 1) return 'Qualify'
  if (index === 2) return 'Third race'

  return 'Out'
}

function getStatusClass(index: number) {
  if (index <= 1) {
    return 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20'
  }

  if (index === 2) {
    return 'bg-yellow-300/10 text-yellow-200 ring-yellow-300/20'
  }

  return 'bg-red-300/10 text-red-200 ring-red-300/20'
}

export function GroupTable({ rows }: GroupTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          <tr>
            <th className="px-3 py-3">#</th>
            <th className="px-3 py-3">Team</th>
            <th className="px-2 py-3 text-center">P</th>
            <th className="px-2 py-3 text-center">W</th>
            <th className="px-2 py-3 text-center">D</th>
            <th className="px-2 py-3 text-center">L</th>
            <th className="px-2 py-3 text-center">GD</th>
            <th className="px-3 py-3 text-center">Pts</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.teamId}
              className="border-t border-white/10 bg-slate-950/35 transition hover:bg-white/5"
            >
              <td className="px-3 py-3">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${getRankStyle(
                    index
                  )}`}
                >
                  {index + 1}
                </span>
              </td>

              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <TeamFlag code={row.flagCode} label={row.teamName} />

                  <div>
                    <p className="font-black text-white">{row.teamName}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-black text-slate-500">{row.shortName}</p>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${getStatusClass(
                          index
                        )}`}
                      >
                        {getStatusLabel(index)}
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-2 py-3 text-center font-bold text-slate-300">{row.played}</td>

              <td className="px-2 py-3 text-center font-bold text-slate-300">{row.won}</td>

              <td className="px-2 py-3 text-center font-bold text-slate-300">{row.drawn}</td>

              <td className="px-2 py-3 text-center font-bold text-slate-300">{row.lost}</td>

              <td className="px-2 py-3 text-center font-bold text-slate-300">
                {row.goalDifference}
              </td>

              <td className="px-3 py-3 text-center text-lg font-black text-yellow-300">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
