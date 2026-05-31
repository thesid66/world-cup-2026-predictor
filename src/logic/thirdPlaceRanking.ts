import { fixtures } from '../data/fixtures'
import { groups } from '../data/groups'
import { teams } from '../data/teams'
import type { PredictionScore, ThirdPlaceTableRow } from '../types/tournament'
import { isGroupComplete, isGroupStageComplete } from './groupProgress'
import { calculateGroupTable } from './groupTable'

export function calculateThirdPlaceRanking(
  scores: Record<string, PredictionScore>
): ThirdPlaceTableRow[] {
  const groupStageComplete = isGroupStageComplete(scores)

  const thirdPlacedTeams: ThirdPlaceTableRow[] = groups
    .map((group): ThirdPlaceTableRow | null => {
      const tableRows = calculateGroupTable({
        group: group.code,
        teams,
        fixtures,
        scores
      })

      const thirdPlaceTeam = tableRows[2]

      if (!thirdPlaceTeam) {
        return null
      }

      return {
        ...thirdPlaceTeam,
        group: group.code,
        groupName: group.name,
        isGroupComplete: isGroupComplete(group.code, scores),
        qualificationStatus: 'waiting'
      }
    })
    .filter((row): row is ThirdPlaceTableRow => row !== null)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points

      if (b.goalDifference !== a.goalDifference) {
        return b.goalDifference - a.goalDifference
      }

      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

      return a.teamName.localeCompare(b.teamName)
    })

  return thirdPlacedTeams.map(
    (row, index): ThirdPlaceTableRow => ({
      ...row,
      qualificationStatus: groupStageComplete ? (index < 8 ? 'qualified' : 'eliminated') : 'waiting'
    })
  )
}
