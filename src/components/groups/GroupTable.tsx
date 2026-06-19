import type { GroupTableRow } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type GroupTableProps = {
  rows: GroupTableRow[]
}

function isDirectQualified(row: GroupTableRow) {
  return row.directQualificationStatus === 'qualified'
}

function getRankStyle(index: number, qualified = false) {
  if (qualified) {
    return 'bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-300/20'
  }

  if (index <= 1) {
    return 'bg-emerald-300 text-emerald-950'
  }

  if (index === 2) {
    return 'bg-yellow-300 text-yellow-950'
  }

  return 'bg-red-300/20 text-red-200'
}

function getStatusLabel(index: number, qualified = false) {
  if (qualified) return 'Qualified'
  if (index <= 1) return 'Qualify'
  if (index === 2) return 'Third race'

  return 'Out'
}

function getStatusClass(index: number, qualified = false) {
  if (qualified) {
    return 'bg-emerald-300/15 text-emerald-100 ring-emerald-300/35'
  }

  if (index <= 1) {
    return 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20'
  }

  if (index === 2) {
    return 'bg-yellow-300/10 text-yellow-200 ring-yellow-300/20'
  }

  return 'bg-red-300/10 text-red-200 ring-red-300/20'
}

function getRowClass(row: GroupTableRow) {
  if (isDirectQualified(row)) {
    return 'border-emerald-300/25 bg-emerald-300/10 shadow-lg shadow-emerald-950/20'
  }

  return 'border-white/10 bg-slate-950/45'
}

function QualifiedBadge() {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-300 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-950 shadow-lg shadow-emerald-300/20">
      Q
    </span>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/6 px-2 py-2 text-center ring-1 ring-white/8">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

export function GroupTable({ rows }: GroupTableProps) {
  return (
    <>
      <div className="grid gap-3 sm:hidden">
        {rows.map((row, index) => {
          const qualified = isDirectQualified(row)

          return (
            <article key={row.teamId} className={`rounded-2xl border p-3 ${getRowClass(row)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${getRankStyle(
                      index,
                      qualified
                    )}`}
                  >
                    {index + 1}
                  </span>

                  <TeamFlag code={row.flagCode} label={row.teamName} />

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-black text-white">{row.teamName}</p>
                      {qualified && <QualifiedBadge />}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-black text-slate-500">{row.shortName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${getStatusClass(
                          index,
                          qualified
                        )}`}
                      >
                        {getStatusLabel(index, qualified)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200">Pts</p>
                  <p className="text-lg font-black text-yellow-300">{row.points}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                <MiniStat label="P" value={row.played} />
                <MiniStat label="W" value={row.won} />
                <MiniStat label="D" value={row.drawn} />
                <MiniStat label="L" value={row.lost} />
                <MiniStat label="GD" value={row.goalDifference} />
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
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
            {rows.map((row, index) => {
              const qualified = isDirectQualified(row)

              return (
                <tr
                  key={row.teamId}
                  className={`border-t transition hover:bg-white/5 ${
                    qualified
                      ? 'border-emerald-300/20 bg-emerald-300/10'
                      : 'border-white/10 bg-slate-950/35'
                  }`}
                >
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${getRankStyle(
                        index,
                        qualified
                      )}`}
                    >
                      {index + 1}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TeamFlag code={row.flagCode} label={row.teamName} />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-white">{row.teamName}</p>
                          {qualified && <QualifiedBadge />}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black text-slate-500">{row.shortName}</p>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${getStatusClass(
                              index,
                              qualified
                            )}`}
                          >
                            {getStatusLabel(index, qualified)}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
