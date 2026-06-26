import { fixtures as defaultFixtures } from '../data/fixtures'
import { groups as defaultGroups } from '../data/groups'
import { teams as defaultTeams } from '../data/teams'
import type {
  Fixture,
  Group,
  GroupCode,
  GroupTableRow,
  PredictionScore,
  Team,
  ThirdPlaceTableRow
} from '../types/tournament'
import { isGroupComplete, isGroupStageComplete } from './groupProgress'
import { calculateGroupTable } from './groupTable'

const THIRD_PLACE_QUALIFIER_COUNT = 8

const POINT_OUTCOMES: Array<{ homePoints: number; awayPoints: number }> = [
  { homePoints: 3, awayPoints: 0 },
  { homePoints: 1, awayPoints: 1 },
  { homePoints: 0, awayPoints: 3 }
]

type CalculateThirdPlaceRankingData = {
  groups?: Group[]
  teams?: Team[]
  fixtures?: Fixture[]
}

function isFixtureScored(fixture: Fixture, scores: Record<string, PredictionScore>) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function compareThirdPlaceRows(a: GroupTableRow, b: GroupTableRow) {
  if (b.points !== a.points) return b.points - a.points

  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference
  }

  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

  return a.teamName.localeCompare(b.teamName)
}

function canKnownThirdPlaceFinishAheadOrLevel(candidate: GroupTableRow, target: GroupTableRow) {
  if (candidate.points !== target.points) return candidate.points > target.points
  if (candidate.goalDifference !== target.goalDifference) {
    return candidate.goalDifference > target.goalDifference
  }
  if (candidate.goalsFor !== target.goalsFor) return candidate.goalsFor > target.goalsFor

  return true
}

function getGroupFixtures(group: GroupCode, fixtures: Fixture[]) {
  return fixtures.filter((fixture) => fixture.stage === 'group' && fixture.group === group)
}

function getInitialGroupPoints(args: {
  group: GroupCode
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
}) {
  const { group, teams, fixtures, scores } = args
  const pointsByTeam = new Map(
    teams.filter((team) => team.group === group).map((team) => [team.id, 0])
  )

  getGroupFixtures(group, fixtures).forEach((fixture) => {
    const score = scores[fixture.id]

    if (typeof score?.homeScore !== 'number' || typeof score?.awayScore !== 'number') {
      return
    }

    if (score.homeScore > score.awayScore) {
      pointsByTeam.set(fixture.homeTeamId, (pointsByTeam.get(fixture.homeTeamId) ?? 0) + 3)
    } else if (score.awayScore > score.homeScore) {
      pointsByTeam.set(fixture.awayTeamId, (pointsByTeam.get(fixture.awayTeamId) ?? 0) + 3)
    } else {
      pointsByTeam.set(fixture.homeTeamId, (pointsByTeam.get(fixture.homeTeamId) ?? 0) + 1)
      pointsByTeam.set(fixture.awayTeamId, (pointsByTeam.get(fixture.awayTeamId) ?? 0) + 1)
    }
  })

  return pointsByTeam
}

function getThirdPlacePoints(pointsByTeam: Map<string, number>) {
  const points = Array.from(pointsByTeam.values()).sort((a, b) => b - a)

  return points[2] ?? 0
}

function getMaximumPossibleThirdPlacePoints(args: {
  group: GroupCode
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
}) {
  const { group, teams, fixtures, scores } = args
  const remainingFixtures = getGroupFixtures(group, fixtures).filter(
    (fixture) => !isFixtureScored(fixture, scores)
  )
  const initialPointsByTeam = getInitialGroupPoints({ group, teams, fixtures, scores })
  let maximumThirdPlacePoints = getThirdPlacePoints(initialPointsByTeam)

  function simulate(fixtureIndex: number, pointsByTeam: Map<string, number>) {
    if (fixtureIndex >= remainingFixtures.length) {
      maximumThirdPlacePoints = Math.max(
        maximumThirdPlacePoints,
        getThirdPlacePoints(pointsByTeam)
      )
      return
    }

    const fixture = remainingFixtures[fixtureIndex]

    POINT_OUTCOMES.forEach((outcome) => {
      const nextPointsByTeam = new Map(pointsByTeam)

      nextPointsByTeam.set(
        fixture.homeTeamId,
        (nextPointsByTeam.get(fixture.homeTeamId) ?? 0) + outcome.homePoints
      )
      nextPointsByTeam.set(
        fixture.awayTeamId,
        (nextPointsByTeam.get(fixture.awayTeamId) ?? 0) + outcome.awayPoints
      )

      simulate(fixtureIndex + 1, nextPointsByTeam)
    })
  }

  simulate(0, initialPointsByTeam)

  return maximumThirdPlacePoints
}

function getPotentialThirdPlaceTeamsAheadCount(args: {
  target: ThirdPlaceTableRow
  rows: ThirdPlaceTableRow[]
  groups: Group[]
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
}) {
  const { target, rows, groups, teams, fixtures, scores } = args

  return groups.filter((group) => {
    if (group.code === target.group) return false

    const groupThirdPlace = rows.find((row) => row.group === group.code)

    if (!groupThirdPlace) return false

    if (groupThirdPlace.isGroupComplete) {
      return canKnownThirdPlaceFinishAheadOrLevel(groupThirdPlace, target)
    }

    return (
      getMaximumPossibleThirdPlacePoints({
        group: group.code,
        teams,
        fixtures,
        scores
      }) >= target.points
    )
  }).length
}

function getThirdPlaceQualificationStatus(args: {
  row: ThirdPlaceTableRow
  index: number
  rows: ThirdPlaceTableRow[]
  groups: Group[]
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
  groupStageComplete: boolean
}): ThirdPlaceTableRow['qualificationStatus'] {
  const { row, index, rows, groups, teams, fixtures, scores, groupStageComplete } = args

  if (groupStageComplete) {
    return index < THIRD_PLACE_QUALIFIER_COUNT ? 'qualified' : 'eliminated'
  }

  if (!row.isGroupComplete) {
    return 'waiting'
  }

  const potentialTeamsAhead = getPotentialThirdPlaceTeamsAheadCount({
    target: row,
    rows,
    groups,
    teams,
    fixtures,
    scores
  })

  return potentialTeamsAhead < THIRD_PLACE_QUALIFIER_COUNT ? 'qualified' : 'waiting'
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
    .sort(compareThirdPlaceRows)

  return thirdPlacedTeams.map(
    (row, index): ThirdPlaceTableRow => ({
      ...row,
      qualificationStatus: getThirdPlaceQualificationStatus({
        row,
        index,
        rows: thirdPlacedTeams,
        groups: activeGroups,
        teams: activeTeams,
        fixtures: activeFixtures,
        scores,
        groupStageComplete
      })
    })
  )
}
