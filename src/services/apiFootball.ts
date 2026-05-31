import type { RealMatchData } from '../types/realMatch'

const API_BASE_URL = 'https://wc26-live-football-api.p.rapidapi.com'

/**
 * If RapidAPI shows different paths for this WC26 API,
 * only update these endpoint values.
 */
const WC26_ENDPOINTS = {
  live: '/live',
  matches: '/matches',
  schedule: '/schedule',
  matchById: (matchId: string | number) => `/matches/${matchId}`,
  matchEvents: (matchId: string | number) => `/matches/${matchId}/events`,
  matchStatistics: (matchId: string | number) => `/statistics/${matchId}`
}

type UnknownRecord = Record<string, unknown>

export type ApiFootballWorldCupFixture = {
  fixture: {
    id: number
    date: string
    venue?: {
      name?: string
      city?: string
    }
    status: {
      long?: string
      short?: string
      elapsed?: number | null
    }
  }
  league: {
    id: number
    name: string
    season: number
    round?: string
  }
  teams: {
    home: {
      id?: number
      name: string
      logo?: string
    }
    away: {
      id?: number
      name: string
      logo?: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

function getRapidApiKey() {
  return import.meta.env.VITE_WC26_RAPIDAPI_KEY as string | undefined
}

function getRapidApiHost() {
  return (
    (import.meta.env.VITE_WC26_RAPIDAPI_HOST as string | undefined) ??
    'wc26-live-football-api.p.rapidapi.com'
  )
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getValueByPath(source: unknown, path: string) {
  if (!isRecord(source)) {
    return undefined
  }

  return path.split('.').reduce<unknown>((currentValue, key) => {
    if (!isRecord(currentValue)) {
      return undefined
    }

    return currentValue[key]
  }, source)
}

function getValueFromPaths(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getValueByPath(source, path)

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return undefined
}

function getStringFromPaths(source: unknown, paths: string[]) {
  const value = getValueFromPaths(source, paths)

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function getNumberFromPaths(source: unknown, paths: string[]) {
  const value = getValueFromPaths(source, paths)

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}

function getNullableNumberFromPaths(source: unknown, paths: string[]) {
  const value = getValueFromPaths(source, paths)

  if (value === null) {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const possibleArray = getValueFromPaths(payload, [
    'data',
    'response',
    'matches',
    'fixtures',
    'results',
    'items'
  ])

  if (Array.isArray(possibleArray)) {
    return possibleArray
  }

  return []
}

function extractFirstItem(payload: unknown) {
  const rows = extractArray(payload)

  if (rows.length > 0) {
    return rows[0]
  }

  if (isRecord(payload)) {
    const possibleItem = getValueFromPaths(payload, [
      'data',
      'response',
      'match',
      'fixture',
      'result'
    ])

    if (isRecord(possibleItem)) {
      return possibleItem
    }

    return payload
  }

  return undefined
}

function formatRapidApiError(payload: unknown) {
  if (!payload) {
    return 'RapidAPI request failed.'
  }

  if (typeof payload === 'string') {
    return payload
  }

  if (!isRecord(payload)) {
    return 'RapidAPI request failed.'
  }

  const message = getStringFromPaths(payload, ['message', 'error'])
  const errors = getValueFromPaths(payload, ['errors'])

  if (message) {
    return message
  }

  if (errors) {
    return JSON.stringify(errors)
  }

  return JSON.stringify(payload)
}

async function apiFootballRequest<T>(path: string): Promise<T> {
  const rapidApiKey = getRapidApiKey()
  const rapidApiHost = getRapidApiHost()

  if (!rapidApiKey) {
    throw new Error('Missing VITE_WC26_RAPIDAPI_KEY in .env.local')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-rapidapi-host': rapidApiHost,
      'x-rapidapi-key': rapidApiKey
    }
  })

  let payload: unknown = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(
      formatRapidApiError(payload) || `RapidAPI request failed with ${response.status}`
    )
  }

  return payload as T
}

async function requestFirstSuccessful<T>(paths: string[]) {
  let lastError: unknown = null

  for (const path of paths) {
    try {
      return await apiFootballRequest<T>(path)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All RapidAPI endpoint attempts failed.')
}

function parseScoreString(scoreText?: string) {
  if (!scoreText) {
    return {
      home: null,
      away: null
    }
  }

  const match = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/)

  if (!match) {
    return {
      home: null,
      away: null
    }
  }

  return {
    home: Number(match[1]),
    away: Number(match[2])
  }
}

function getBestScoreFromRawMatch(rawMatch: unknown) {
  let home =
    getNullableNumberFromPaths(rawMatch, [
      'goals.home',
      'score.home',
      'scores.home',
      'home_score',
      'homeScore',
      'home_goals',
      'home.goals',
      'home.score',
      'home_team.score'
    ]) ?? null

  let away =
    getNullableNumberFromPaths(rawMatch, [
      'goals.away',
      'score.away',
      'scores.away',
      'away_score',
      'awayScore',
      'away_goals',
      'away.goals',
      'away.score',
      'away_team.score'
    ]) ?? null

  if (home === null || away === null) {
    const parsedScore = parseScoreString(
      getStringFromPaths(rawMatch, [
        'score',
        'result',
        'fulltime',
        'full_time',
        'fulltime_score',
        'final_score'
      ])
    )

    home = parsedScore.home
    away = parsedScore.away
  }

  return {
    home,
    away,
    display:
      typeof home === 'number' && typeof away === 'number' ? `${home} - ${away}` : 'Not available'
  }
}

function normaliseRawMatchToFixture(rawMatch: unknown): ApiFootballWorldCupFixture | null {
  const id = getNumberFromPaths(rawMatch, ['fixture.id', 'id', 'match_id', 'matchId'])

  if (!id) {
    return null
  }

  const date =
    getStringFromPaths(rawMatch, [
      'fixture.date',
      'date',
      'datetime',
      'starting_at',
      'kickoff',
      'kickoff_time',
      'match_date'
    ]) ?? ''

  const homeTeamName =
    getStringFromPaths(rawMatch, [
      'teams.home.name',
      'home.name',
      'home_team.name',
      'homeTeam.name',
      'home_team',
      'homeTeam',
      'team_home'
    ]) ?? 'Home team'

  const awayTeamName =
    getStringFromPaths(rawMatch, [
      'teams.away.name',
      'away.name',
      'away_team.name',
      'awayTeam.name',
      'away_team',
      'awayTeam',
      'team_away'
    ]) ?? 'Away team'

  const score = getBestScoreFromRawMatch(rawMatch)

  return {
    fixture: {
      id,
      date,
      venue: {
        name: getStringFromPaths(rawMatch, [
          'fixture.venue.name',
          'venue.name',
          'stadium.name',
          'stadium',
          'venue'
        ]),
        city: getStringFromPaths(rawMatch, [
          'fixture.venue.city',
          'venue.city',
          'stadium.city',
          'city'
        ])
      },
      status: {
        long: getStringFromPaths(rawMatch, [
          'fixture.status.long',
          'status.long',
          'status.name',
          'status',
          'state.name'
        ]),
        short: getStringFromPaths(rawMatch, [
          'fixture.status.short',
          'status.short',
          'status_code',
          'state.short_name',
          'state'
        ]),
        elapsed: getNullableNumberFromPaths(rawMatch, [
          'fixture.status.elapsed',
          'status.elapsed',
          'elapsed',
          'minute'
        ])
      }
    },
    league: {
      id: getNumberFromPaths(rawMatch, ['league.id', 'competition.id']) ?? 2026,
      name:
        getStringFromPaths(rawMatch, [
          'league.name',
          'competition.name',
          'tournament',
          'competition'
        ]) ?? 'FIFA World Cup 2026',
      season: getNumberFromPaths(rawMatch, ['league.season', 'season', 'year']) ?? 2026,
      round: getStringFromPaths(rawMatch, ['league.round', 'round', 'stage', 'phase', 'group'])
    },
    teams: {
      home: {
        id: getNumberFromPaths(rawMatch, [
          'teams.home.id',
          'home.id',
          'home_team.id',
          'homeTeam.id',
          'home_team_id'
        ]),
        name: homeTeamName,
        logo: getStringFromPaths(rawMatch, [
          'teams.home.logo',
          'home.logo',
          'home_team.logo',
          'homeTeam.logo',
          'home_team_logo'
        ])
      },
      away: {
        id: getNumberFromPaths(rawMatch, [
          'teams.away.id',
          'away.id',
          'away_team.id',
          'awayTeam.id',
          'away_team_id'
        ]),
        name: awayTeamName,
        logo: getStringFromPaths(rawMatch, [
          'teams.away.logo',
          'away.logo',
          'away_team.logo',
          'awayTeam.logo',
          'away_team_logo'
        ])
      }
    },
    goals: {
      home: score.home,
      away: score.away
    }
  }
}

function normaliseStatistics(rawStatistics: unknown): RealMatchData['statistics'] {
  const rows = extractArray(rawStatistics)

  return rows.map((row) => {
    const statisticsValue = getValueFromPaths(row, ['statistics', 'stats', 'values'])

    const statisticsRows = Array.isArray(statisticsValue)
      ? statisticsValue
      : isRecord(row)
        ? Object.entries(row)
            .filter(([key, value]) => {
              return (
                !['team', 'teamName', 'team_name', 'name', 'id', 'logo'].includes(key) &&
                (typeof value === 'string' || typeof value === 'number' || value === null)
              )
            })
            .map(([key, value]) => ({
              type: key,
              value: value as string | number | null
            }))
        : []

    return {
      teamId: getNumberFromPaths(row, ['team.id', 'team_id', 'participant_id']),
      teamName: getStringFromPaths(row, ['team.name', 'teamName', 'team_name', 'name']) ?? 'Team',
      teamLogo: getStringFromPaths(row, ['team.logo', 'teamLogo', 'team_logo', 'logo']),
      statistics: statisticsRows
        .map((statisticRow) => {
          if (!isRecord(statisticRow)) {
            return null
          }

          const type = getStringFromPaths(statisticRow, ['type', 'name', 'label']) ?? ''

          const value = getValueFromPaths(statisticRow, ['value', 'stat'])

          if (!type) {
            return null
          }

          return {
            type,
            value:
              typeof value === 'string' || typeof value === 'number' || value === null
                ? value
                : String(value ?? '')
          }
        })
        .filter((row): row is { type: string; value: string | number | null } => Boolean(row))
    }
  })
}

function normaliseEvents(rawEvents: unknown): RealMatchData['events'] {
  return extractArray(rawEvents).map((event) => ({
    elapsed: getNullableNumberFromPaths(event, ['time.elapsed', 'elapsed', 'minute']),
    extra: getNullableNumberFromPaths(event, ['time.extra', 'extra']),
    teamName: getStringFromPaths(event, ['team.name', 'teamName', 'team_name', 'team']),
    playerName: getStringFromPaths(event, ['player.name', 'playerName', 'player_name', 'player']),
    assistName: getStringFromPaths(event, ['assist.name', 'assistName', 'assist_name', 'assist']),
    type: getStringFromPaths(event, ['type', 'event_type']),
    detail: getStringFromPaths(event, ['detail', 'description', 'event'])
  }))
}

export async function fetchApiFootballLiveMatches() {
  return apiFootballRequest<unknown>(WC26_ENDPOINTS.live)
}

export async function fetchApiFootballWorldCup2026Fixtures() {
  const payload = await requestFirstSuccessful<unknown>([
    WC26_ENDPOINTS.matches,
    WC26_ENDPOINTS.schedule
  ])

  return extractArray(payload)
    .map(normaliseRawMatchToFixture)
    .filter((fixture): fixture is ApiFootballWorldCupFixture => Boolean(fixture))
}

export async function fetchApiFootballMatchData(apiFixtureId: number): Promise<RealMatchData> {
  const rawMatchPayload = await requestFirstSuccessful<unknown>([
    WC26_ENDPOINTS.matchById(apiFixtureId),
    `/match/${apiFixtureId}`,
    `/fixtures/${apiFixtureId}`
  ])

  const rawMatch = extractFirstItem(rawMatchPayload)
  const fixture = normaliseRawMatchToFixture(rawMatch)

  if (!fixture) {
    throw new Error('No match found for this WC26 RapidAPI fixture ID.')
  }

  const [statisticsResult, eventsResult] = await Promise.allSettled([
    requestFirstSuccessful<unknown>([
      WC26_ENDPOINTS.matchStatistics(apiFixtureId),
      `/statistics?match=${apiFixtureId}`,
      `/statistics?match_id=${apiFixtureId}`,
      `/matches/${apiFixtureId}/statistics`
    ]),
    requestFirstSuccessful<unknown>([
      WC26_ENDPOINTS.matchEvents(apiFixtureId),
      `/events/${apiFixtureId}`,
      `/events?match=${apiFixtureId}`,
      `/events?match_id=${apiFixtureId}`,
      `/matches/${apiFixtureId}/events`
    ])
  ])

  const rawStatistics = statisticsResult.status === 'fulfilled' ? statisticsResult.value : []

  const rawEvents = eventsResult.status === 'fulfilled' ? eventsResult.value : []

  const score = getBestScoreFromRawMatch(rawMatch)

  return {
    provider: 'api-football',
    apiFixtureId,
    fetchedAt: new Date().toISOString(),
    status: {
      long: fixture.fixture.status.long,
      short: fixture.fixture.status.short,
      elapsed: fixture.fixture.status.elapsed
    },
    homeTeam: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      logo: fixture.teams.home.logo
    },
    awayTeam: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      logo: fixture.teams.away.logo
    },
    score,
    statistics: normaliseStatistics(rawStatistics),
    events: normaliseEvents(rawEvents)
  }
}
