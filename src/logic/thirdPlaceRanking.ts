import { fixtures as defaultFixtures } from '../data/fixtures'
import { groups as defaultGroups } from '../data/groups'
import { teams as defaultTeams } from '../data/teams'
import type { Fixture, Group, PredictionScore, Team, ThirdPlaceTableRow } from '../types/tournament'
import { isGroupComplete, isGroupStageComplete } from './groupProgress'
import { calculateGroupTable } from './groupTable'

type CalculateThirdPlaceRankingData = {
  groups?: Group[]
  teams?: Team[]
  fixtures?: Fixture[]
}

export function calculateThirdPlaceRanking(
  scores: Record<string, PredictionScore>,
  data: CalculateThirdPlaceRankingData = {}
): ThirdPlaceTableRow[] {
  const activeGroups = data.groups ?? defaultGroups
  const activeTeams = data.teams ?? defaultTeams
  const activeFixtures = data.fixtures ?? defaultFixtures
  const groupStageComplete = isGroupStageComplete(scores, activeFixtures)

  const thirdPlacedTeams: ThirdPlaceTableRow[] = activeGroups
    .map((group): ThirdPlaceTableRow | null => {
      const tableRows = calculateGroupTable({
        group: group.code,
        teams: activeTeams,
        fixtures: activeFixtures,
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
        isGroupComplete: isGroupComplete(group.code, scores, activeFixtures),
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
