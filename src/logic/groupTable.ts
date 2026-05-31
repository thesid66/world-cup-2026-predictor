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
    points: 0
  }
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

  return Array.from(tableMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points

    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference
    }

    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

    return a.teamName.localeCompare(b.teamName)
  })
}
