import type { ApiFootballWorldCupFixture } from '../services/apiFootball'
import type { Fixture, Team } from '../types/tournament'

type FixtureMappingResult = {
  localFixture: Fixture
  apiFixture?: ApiFootballWorldCupFixture
  confidence: 'exact' | 'swapped' | 'unmatched'
  reason: string
}

const teamAliases: Record<string, string[]> = {
  'united-states': ['united states', 'usa'],
  'korea-republic': ['korea republic', 'south korea'],
  'cote-divoire': ["côte d'ivoire", "cote d'ivoire", 'ivory coast'],
  'ir-iran': ['ir iran', 'iran'],
  turkiye: ['türkiye', 'turkiye', 'turkey'],
  czechia: ['czechia', 'czech republic'],
  'cabo-verde': ['cabo verde', 'cape verde'],
  'congo-dr': ['dr congo', 'congo dr', 'democratic republic of the congo'],
  'bosnia-herzegovina': ['bosnia and herzegovina', 'bosnia-herzegovina', 'bosnia']
}

function normaliseName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getLocalTeamNames(team: Team | undefined) {
  if (!team) {
    return []
  }

  const names = [team.name, team.shortName, ...(teamAliases[team.id] ?? [])]

  return names.map(normaliseName)
}

function apiNameMatchesLocalTeam(apiName: string, localTeam?: Team) {
  const normalisedApiName = normaliseName(apiName)
  const localNames = getLocalTeamNames(localTeam)

  return localNames.includes(normalisedApiName)
}

function getApiFixtureDate(apiFixture: ApiFootballWorldCupFixture) {
  return apiFixture.fixture.date.slice(0, 10)
}

function isSameDateOrClose(localDate: string, apiDate: string) {
  if (localDate === apiDate) {
    return true
  }

  const local = new Date(`${localDate}T00:00:00Z`).getTime()
  const api = new Date(`${apiDate}T00:00:00Z`).getTime()
  const day = 24 * 60 * 60 * 1000

  return Math.abs(local - api) <= day
}

export function mapApiFootballFixtures(args: {
  localFixtures: Fixture[]
  apiFixtures: ApiFootballWorldCupFixture[]
  teams: Team[]
}): FixtureMappingResult[] {
  const { localFixtures, apiFixtures, teams } = args
  const usedApiFixtureIds = new Set<number>()

  return localFixtures.map((localFixture) => {
    const homeTeam = teams.find((team) => team.id === localFixture.homeTeamId)
    const awayTeam = teams.find((team) => team.id === localFixture.awayTeamId)

    const candidates = apiFixtures.filter((apiFixture) => {
      if (usedApiFixtureIds.has(apiFixture.fixture.id)) {
        return false
      }

      const apiDate = getApiFixtureDate(apiFixture)

      return isSameDateOrClose(localFixture.date, apiDate)
    })

    const exactMatch = candidates.find(
      (apiFixture) =>
        apiNameMatchesLocalTeam(apiFixture.teams.home.name, homeTeam) &&
        apiNameMatchesLocalTeam(apiFixture.teams.away.name, awayTeam)
    )

    if (exactMatch) {
      usedApiFixtureIds.add(exactMatch.fixture.id)

      return {
        localFixture,
        apiFixture: exactMatch,
        confidence: 'exact',
        reason: 'Home and away teams matched.'
      }
    }

    const swappedMatch = candidates.find(
      (apiFixture) =>
        apiNameMatchesLocalTeam(apiFixture.teams.home.name, awayTeam) &&
        apiNameMatchesLocalTeam(apiFixture.teams.away.name, homeTeam)
    )

    if (swappedMatch) {
      usedApiFixtureIds.add(swappedMatch.fixture.id)

      return {
        localFixture,
        apiFixture: swappedMatch,
        confidence: 'swapped',
        reason: 'Teams matched, but API home/away order is different.'
      }
    }

    return {
      localFixture,
      confidence: 'unmatched',
      reason: 'No API fixture matched this local fixture.'
    }
  })
}

export function generateApiFootballFixtureIdMapCode(mappingResults: FixtureMappingResult[]) {
  const mappedResults = mappingResults.filter((result) => result.apiFixture)

  const lines = mappedResults.map((result) => {
    return `  '${result.localFixture.id}': ${result.apiFixture?.fixture.id},`
  })

  return `export const apiFootballFixtureIdMap: Record<string, number> = {
${lines.join('\n')}
};
`
}
