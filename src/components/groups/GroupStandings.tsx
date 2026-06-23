import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { calculateGroupTable } from '../../logic/groupTable'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { Fixture, GroupCode } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'
import { GroupTable } from './GroupTable'

type GroupStandingsProps = { groupCode: GroupCode }

function getCompletedMatches(
  groupFixtures: Fixture[],
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  return groupFixtures.filter((fixture) => {
    const score = scores[fixture.id]
    return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  }).length
}

export function GroupStandings({ groupCode }: GroupStandingsProps) {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, fixtures } = useTournamentData()
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)

  const groupFixtures = fixtures.filter(
    (fixture) => fixture.stage === 'group' && fixture.group === groupCode
  )
  const tableRows = calculateGroupTable({ group: groupCode, teams, fixtures, scores })
  const completedMatches = getCompletedMatches(groupFixtures, scores)
  const leader = tableRows[0]

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/55 shadow-xl sm:rounded-3xl">
      <div className="border-b border-white/10 bg-linear-to-r from-yellow-300/10 to-sky-300/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h4 className="text-xl font-black text-white">Group {groupCode}</h4>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {completedMatches}/6 matches scored
            </p>
          </div>
          {leader && (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
                Leader
              </p>
              <div className="mt-2 flex items-center gap-2 sm:justify-end">
                <TeamFlag code={leader.flagCode} label={leader.teamName} size="sm" />
                <p className="text-sm font-black text-white">{leader.teamName}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <GroupTable rows={tableRows} fixtures={groupFixtures} scores={scores} teams={teams} />
      </div>
    </div>
  )
}
