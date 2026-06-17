import { supabase } from '../lib/supabase'
import { teams as localTeams } from '../data/teams'
import { groups as localGroups } from '../data/groups'
import { fixtures as localFixtures } from '../data/fixtures'
import { apiFootballFixtureIdMap as localApiFootballFixtureIdMap } from '../data/apiFootballFixtureIds'

import type { Confederation, Fixture, Group, GroupCode, Stage, Team } from '../types/tournament'

type DatabaseFixture = {
  id: string
  match_number: number
  stage: string
  group_code: string | null
  date: string
  kickoff_time: string | null
  kickoff_time_sort: string | null
  venue: string
  city: string
  home_team_id: string
  away_team_id: string
}

type DatabaseTeam = {
  id: string
  name: string
  short_name: string | null
  flag_code: string | null
  confederation: string | null
  group_code: string | null
}

type DatabaseGroup = {
  id: string
  name: string
  sort_order: number
}

type DatabaseApiFixtureMapping = {
  local_fixture_id: string
  api_fixture_id: number | null
  api_fixture_slug: string | null
  api_match_url: string | null
}

export type TournamentData = {
  teams: Team[]
  groups: Group[]
  fixtures: Fixture[]
  apiFootballFixtureIdMap: Record<string, number>
  sportScoreFixtureSlugMap: Record<string, string>
  sportScoreFixtureUrlMap: Record<string, string>
  source: 'database' | 'local'
}

const groupCodes: GroupCode[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const stages: Stage[] = [
  'group',
  'round32',
  'round16',
  'quarterFinal',
  'semiFinal',
  'thirdPlace',
  'final'
]

const confederations: Confederation[] = ['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA']

function toGroupCode(value: string | null | undefined): GroupCode | undefined {
  if (!value) {
    return undefined
  }

  return groupCodes.includes(value as GroupCode) ? (value as GroupCode) : undefined
}

function toRequiredGroupCode(value: string | null | undefined): GroupCode {
  const groupCode = toGroupCode(value)

  if (!groupCode) {
    throw new Error(`Invalid group code: ${value}`)
  }

  return groupCode
}

function toStage(value: string): Stage {
  if (stages.includes(value as Stage)) {
    return value as Stage
  }

  throw new Error(`Invalid stage: ${value}`)
}

function toConfederation(value: string | null | undefined): Confederation {
  if (value && confederations.includes(value as Confederation)) {
    return value as Confederation
  }

  throw new Error(`Invalid confederation: ${value}`)
}

function mapDatabaseFixture(row: DatabaseFixture): Fixture {
  return {
    id: row.id,
    matchNumber: row.match_number,
    stage: toStage(row.stage),
    group: toGroupCode(row.group_code),
    date: row.date,
    kickoffTime: row.kickoff_time ?? undefined,
    kickoffTimeSort: row.kickoff_time_sort ?? undefined,
    venue: row.venue,
    city: row.city,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id
  }
}

function mapDatabaseTeam(row: DatabaseTeam): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? row.name,
    flagCode: row.flag_code ?? '',
    confederation: toConfederation(row.confederation),
    group: toRequiredGroupCode(row.group_code)
  }
}

function mapDatabaseGroup(row: DatabaseGroup): Group {
  return {
    code: toRequiredGroupCode(row.id),
    name: row.name
  }
}

function buildApiFootballFixtureIdMap(rows: DatabaseApiFixtureMapping[]) {
  return rows.reduce<Record<string, number>>((map, row) => {
    if (typeof row.api_fixture_id === 'number') {
      map[row.local_fixture_id] = row.api_fixture_id
    }

    return map
  }, {})
}

function buildSportScoreFixtureSlugMap(rows: DatabaseApiFixtureMapping[]) {
  return rows.reduce<Record<string, string>>((map, row) => {
    if (row.api_fixture_slug) {
      map[row.local_fixture_id] = row.api_fixture_slug
    }

    return map
  }, {})
}

function buildSportScoreFixtureUrlMap(rows: DatabaseApiFixtureMapping[]) {
  return rows.reduce<Record<string, string>>((map, row) => {
    if (row.api_match_url) {
      map[row.local_fixture_id] = row.api_match_url
    }

    return map
  }, {})
}

function getLocalTournamentData(): TournamentData {
  return {
    teams: localTeams,
    groups: localGroups,
    fixtures: localFixtures,
    apiFootballFixtureIdMap: localApiFootballFixtureIdMap,
    sportScoreFixtureSlugMap: {},
    sportScoreFixtureUrlMap: {},
    source: 'local'
  }
}

export async function loadTournamentData(): Promise<TournamentData> {
  if (!supabase) {
    return getLocalTournamentData()
  }

  try {
    const [teamsResult, groupsResult, fixturesResult, mappingsResult] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('fixtures').select('*').order('match_number'),
      supabase.from('api_fixture_mappings').select('*')
    ])

    if (
      teamsResult.error ||
      groupsResult.error ||
      fixturesResult.error ||
      mappingsResult.error ||
      !teamsResult.data?.length ||
      !groupsResult.data?.length ||
      !fixturesResult.data?.length
    ) {
      throw new Error('Database tournament data is not ready.')
    }

    const databaseTeams = teamsResult.data as DatabaseTeam[]
    const databaseGroups = groupsResult.data as DatabaseGroup[]
    const databaseFixtures = fixturesResult.data as DatabaseFixture[]
    const databaseMappings = (mappingsResult.data ?? []) as DatabaseApiFixtureMapping[]

    return {
      teams: databaseTeams.map(mapDatabaseTeam),
      groups: databaseGroups.map(mapDatabaseGroup),
      fixtures: databaseFixtures.map(mapDatabaseFixture),
      apiFootballFixtureIdMap: buildApiFootballFixtureIdMap(databaseMappings),
      sportScoreFixtureSlugMap: buildSportScoreFixtureSlugMap(databaseMappings),
      sportScoreFixtureUrlMap: buildSportScoreFixtureUrlMap(databaseMappings),
      source: 'database'
    }
  } catch {
    return getLocalTournamentData()
  }
}
