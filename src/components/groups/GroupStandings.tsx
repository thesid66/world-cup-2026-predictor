import { useTournamentData } from '../../context/TournamentDataContext'
import { calculateGroupTable } from '../../logic/groupTable'
import { usePredictionStore } from '../../store/predictionStore'
import type { Fixture, GroupCode } from '../../types/tournament'
import { GroupTable } from './GroupTable'

type GroupStandingsProps = { groupCode: GroupCode }

function getCompletedMatches(
  groupCode: GroupCode,
  fixtures: Fixture[],
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  return fixtures
    .filter((fixture) => fixture.stage === 'group' && fixture.group === groupCode)
    .filter((fixture) => {
      const score = scores[fixture.id]
      return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
    }).length
}

export function GroupStandings({ groupCode }: GroupStandingsProps) {
  const scores = usePredictionStore((state) => state.scores)
  const { teams, fixtures } = useTournamentData()

  const tableRows = calculateGroupTable({ group: groupCode, teams, fixtures, scores })
  const completedMatches = getCompletedMatches(groupCode, fixtures, scores)
  const leader = tableRows[0]

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/55 shadow-xl sm:rounded-3xl">
      <div className="border-b border-white/10 bg-linear-to-r from-yellow-300/10 to-sky-300/10 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300 sm:text-xs sm:tracking-[0.25em]">
          Live standings
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h4 className="text-xl font-black text-white">Group {groupCode}</h4>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {completedMatches}/6 matches predicted
            </p>
          </div>
          {leader && (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
                Leader
              </p>
              <p className="mt-1 text-sm font-black text-white">{leader.shortName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <GroupTable rows={tableRows} />
        <div className="mt-4 grid gap-2 text-center sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-2 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200">
              1st - 2nd
            </p>
            <p className="mt-1 text-xs font-bold text-slate-300">Qualify</p>
          </div>
          <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 px-2 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-yellow-200">3rd</p>
            <p className="mt-1 text-xs font-bold text-slate-300">Best third</p>
          </div>
          <div className="rounded-xl border border-red-300/20 bg-red-300/10 px-2 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-200">4th</p>
            <p className="mt-1 text-xs font-bold text-slate-300">Out</p>
          </div>
        </div>
      </div>
    </div>
  )
}
