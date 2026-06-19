import { fixtures } from '../data/fixtures'
import { groups } from '../data/groups'
import { teams } from '../data/teams'
import type { PredictionScore, QualifiedTeamRow, QualifiedTeamsResult } from '../types/tournament'
import { isGroupComplete } from './groupProgress'
import { calculateGroupTable } from './groupTable'
import { calculateThirdPlaceRanking } from './thirdPlaceRanking'

export function getQualifiedTeams(scores: Record<string, PredictionScore>): QualifiedTeamsResult {
  const directQualifiers: QualifiedTeamRow[] = groups.flatMap((group) => {
    const groupComplete = isGroupComplete(group.code, scores)

    const tableRows = calculateGroupTable({
      group: group.code,
      teams,
      fixtures,
      scores
    })

    return tableRows
      .map((row, index): QualifiedTeamRow | null => {
        const groupPosition = index + 1
        const isDirectPosition = groupPosition <= 2
        const hasLockedQualification = row.directQualificationStatus === 'qualified'

        if (!groupComplete && !hasLockedQualification) {
          return null
        }

        if (groupComplete && !isDirectPosition) {
          return null
        }

        const isWinner = groupPosition === 1

        return {
          ...row,
          group: group.code,
          groupName: group.name,
          groupPosition,
          qualificationSource: isWinner ? 'groupWinner' : 'groupRunnerUp',
          isGroupComplete: groupComplete,
          seedLabel: `${groupPosition}${group.code}`
        }
      })
      .filter((row): row is QualifiedTeamRow => Boolean(row))
  })

  const thirdPlaceQualifiers: QualifiedTeamRow[] = calculateThirdPlaceRanking(scores)
    .filter((row) => row.qualificationStatus === 'qualified')
    .map((row): QualifiedTeamRow => {
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        shortName: row.shortName,
        flagCode: row.flagCode,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        directQualificationStatus: row.directQualificationStatus,
        group: row.group,
        groupName: row.groupName,
        groupPosition: 3,
        qualificationSource: 'thirdPlace',
        isGroupComplete: row.isGroupComplete,
        seedLabel: `3${row.group}`
      }
    })

  return {
    directQualifiers,
    thirdPlaceQualifiers,
    allQualifiedTeams: [...directQualifiers, ...thirdPlaceQualifiers]
  }
}
