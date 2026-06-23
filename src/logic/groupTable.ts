import type { Fixture, GroupCode, GroupTableRow, PredictionScore, Team } from '../types/tournament'

type CalculateGroupTableArgs = {
  group: GroupCode
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
}

function createEmptyRow(team: Team): GroupTableRow {
  return {
    teamId: team.id,
    teamName: team.name,
    shortName: team.shortName,
    flagCode: team.flagCode,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    directQualificationStatus: 'pending'
  }
}

function isFixtureScored(fixture: Fixture, scores: Record<string, PredictionScore>) {
  const prediction = scores[fixture.id]

  return typeof prediction?.homeScore === 'number' && typeof prediction?.awayScore === 'number'
}

function canTeamFallOutsideDirectQualification(args: {
  row: GroupTableRow
  rows: GroupTableRow[]
  groupFixtures: Fixture[]
  scores: Record<string, PredictionScore>
}) {
  const { row, rows, groupFixtures, scores } = args
  const remainingFixtures = groupFixtures.filter((fixture) => !isFixtureScored(fixture, scores))
  const initialPointsByTeam = new Map(rows.map((tableRow) => [tableRow.teamId, tableRow.points]))

  function hasTwoTeamsLevelOrAbove(pointsByTeam: Map<string, number>) {
    const targetPoints = pointsByTeam.get(row.teamId) ?? row.points
    const levelOrAboveCount = rows.filter((otherRow) => {
      if (otherRow.teamId === row.teamId) return false

      return (pointsByTeam.get(otherRow.teamId) ?? otherRow.points) >= targetPoints
    }).length

    return levelOrAboveCount >= 2
  }

  function simulate(fixtureIndex: number, pointsByTeam: Map<string, number>): boolean {
    if (fixtureIndex >= remainingFixtures.length) {
      return hasTwoTeamsLevelOrAbove(pointsByTeam)
    }

    const fixture = remainingFixtures[fixtureIndex]
    const outcomes: Array<{ homePoints: number; awayPoints: number }> = [
      { homePoints: 3, awayPoints: 0 },
      { homePoints: 1, awayPoints: 1 },
      { homePoints: 0, awayPoints: 3 }
    ]

    return outcomes.some((outcome) => {
      const nextPointsByTeam = new Map(pointsByTeam)

      nextPointsByTeam.set(
        fixture.homeTeamId,
        (nextPointsByTeam.get(fixture.homeTeamId) ?? 0) + outcome.homePoints
      )
      nextPointsByTeam.set(
        fixture.awayTeamId,
        (nextPointsByTeam.get(fixture.awayTeamId) ?? 0) + outcome.awayPoints
      )

      return simulate(fixtureIndex + 1, nextPointsByTeam)
    })
  }

  return simulate(0, initialPointsByTeam)
}

function applyDirectQualificationStatus(args: {
  rows: GroupTableRow[]
  groupFixtures: Fixture[]
  scores: Record<string, PredictionScore>
}) {
  const { rows, groupFixtures, scores } = args
  const groupComplete = groupFixtures.every((fixture) => isFixtureScored(fixture, scores))

  if (groupComplete) {
    rows.forEach((row, index) => {
      row.directQualificationStatus = index <= 1 ? 'qualified' : 'pending'
    })

    return rows
  }

  rows.forEach((row) => {
    const canFallOutsideDirectQualification = canTeamFallOutsideDirectQualification({
      row,
      rows,
      groupFixtures,
      scores
    })

    row.directQualificationStatus =
      row.played > 0 && !canFallOutsideDirectQualification ? 'qualified' : 'pending'
  })

  return rows
}

export function calculateGroupTable({
  group,
  teams,
  fixtures,
  scores
}: CalculateGroupTableArgs): GroupTableRow[] {
  const groupTeams = teams.filter((team) => team.group === group)

  const tableMap = new Map<string, GroupTableRow>()

  groupTeams.forEach((team) => {
    tableMap.set(team.id, createEmptyRow(team))
  })

  const groupFixtures = fixtures.filter(
    (fixture) => fixture.stage === 'group' && fixture.group === group
  )

  groupFixtures.forEach((fixture) => {
    const prediction = scores[fixture.id]

    if (!prediction || prediction.homeScore === null || prediction.awayScore === null) {
      return
    }

    const homeRow = tableMap.get(fixture.homeTeamId)
    const awayRow = tableMap.get(fixture.awayTeamId)

    if (!homeRow || !awayRow) {
      return
    }

    const homeScore = prediction.homeScore
    const awayScore = prediction.awayScore

    homeRow.played += 1
    awayRow.played += 1

    homeRow.goalsFor += homeScore
    homeRow.goalsAgainst += awayScore

    awayRow.goalsFor += awayScore
    awayRow.goalsAgainst += homeScore

    if (homeScore > awayScore) {
      homeRow.won += 1
      homeRow.points += 3
      awayRow.lost += 1
    } else if (awayScore > homeScore) {
      awayRow.won += 1
      awayRow.points += 3
      homeRow.lost += 1
    } else {
      homeRow.drawn += 1
      awayRow.drawn += 1

      homeRow.points += 1
      awayRow.points += 1
    }

    homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst
    awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst
  })

  const sortedRows = Array.from(tableMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points

    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference
    }

    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

    return a.teamName.localeCompare(b.teamName)
  })

  return applyDirectQualificationStatus({
    rows: sortedRows,
    groupFixtures,
    scores
  })
}
