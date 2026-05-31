import { fixtures } from '../../data/fixtures'
import { teams } from '../../data/teams'
import { calculateGroupTable } from '../../logic/groupTable'
import { usePredictionStore } from '../../store/predictionStore'
import type { GroupCode } from '../../types/tournament'
import { GroupTable } from './GroupTable'

type GroupStandingsProps = {
  groupCode: GroupCode
}

function getCompletedMatches(
  groupCode: GroupCode,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const groupFixtures = fixtures.filter(
    (fixture) => fixture.stage === 'group' && fixture.group === groupCode
  )

  return groupFixtures.filter((fixture) => {
    const score = scores[fixture.id]

    return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  }).length
}

export function GroupStandings({ groupCode }: GroupStandingsProps) {
  const scores = usePredictionStore((state) => state.scores)

  const tableRows = calculateGroupTable({
    group: groupCode,
    teams,
    fixtures,
    scores
  })

  const completedMatches = getCompletedMatches(groupCode, scores)
  const leader = tableRows[0]

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-xl">
      <div className="border-b border-white/10 bg-linear-to-r from-yellow-300/10 to-sky-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Live standings
        </p>

        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-white">Group {groupCode}</h4>

            <p className="mt-1 text-xs font-bold text-slate-400">
              {completedMatches}/6 matches predicted
            </p>
          </div>

          {leader && (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
                Leader
              </p>

              <p className="mt-1 text-sm font-black text-white">{leader.shortName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <GroupTable rows={tableRows} />

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-2 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200">
              1st - 2nd
            </p>
            <p className="mt-1 text-xs font-bold text-slate-300">Qualify</p>
          </div>

          <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 px-2 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-yellow-200">
              3rd
            </p>
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
