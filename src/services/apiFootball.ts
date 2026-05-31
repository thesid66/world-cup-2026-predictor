import type { RealMatchData } from '../types/realMatch'

const API_BASE_URL = 'https://v3.football.api-sports.io'

type ApiFootballResponse<T> = {
  get: string
  parameters: Record<string, string>
  errors: unknown[] | Record<string, string>
  results: number
  paging: {
    current: number
    total: number
  }
  response: T
}

type ApiFootballFixture = {
  fixture: {
    id: number
    status: {
      long?: string
      short?: string
      elapsed?: number | null
    }
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
  score: {
    halftime?: {
      home: number | null
      away: number | null
    }
    fulltime?: {
      home: number | null
      away: number | null
    }
    extratime?: {
      home: number | null
      away: number | null
    }
    penalty?: {
      home: number | null
      away: number | null
    }
  }
}

type ApiFootballStatisticRow = {
  team: {
    id?: number
    name: string
    logo?: string
  }
  statistics: {
    type: string
    value: string | number | null
  }[]
}

type ApiFootballEvent = {
  time: {
    elapsed?: number | null
    extra?: number | null
  }
  team: {
    name?: string
  }
  player: {
    name?: string
  }
  assist: {
    name?: string
  }
  type?: string
  detail?: string
}

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

function getApiKey() {
  return import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined
}

function hasApiErrors(errors: unknown[] | Record<string, string>) {
  if (Array.isArray(errors)) {
    return errors.length > 0
  }

  return Object.keys(errors).length > 0
}

function formatApiFootballErrors(errors: unknown[] | Record<string, string>) {
  if (Array.isArray(errors)) {
    return errors
      .map((error) => String(error))
      .filter(Boolean)
      .join(', ')
  }

  return Object.entries(errors)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

async function apiFootballRequest<T>(path: string): Promise<T> {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new Error('Missing VITE_API_FOOTBALL_KEY in .env.local')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey
    }
  })

  if (!response.ok) {
    throw new Error(`API-Football request failed with ${response.status}`)
  }

  const payload = (await response.json()) as ApiFootballResponse<T>

  if (hasApiErrors(payload.errors)) {
    throw new Error(formatApiFootballErrors(payload.errors))
  }

  return payload.response
}

function getBestScore(fixture: ApiFootballFixture) {
  const home =
    fixture.goals.home ??
    fixture.score.fulltime?.home ??
    fixture.score.extratime?.home ??
    fixture.score.penalty?.home ??
    null

  const away =
    fixture.goals.away ??
    fixture.score.fulltime?.away ??
    fixture.score.extratime?.away ??
    fixture.score.penalty?.away ??
    null

  return {
    home,
    away,
    display:
      typeof home === 'number' && typeof away === 'number' ? `${home} - ${away}` : 'Not available'
  }
}

export async function fetchApiFootballMatchData(apiFixtureId: number): Promise<RealMatchData> {
  const [fixtureRows, statisticsRows, eventRows] = await Promise.all([
    apiFootballRequest<ApiFootballFixture[]>(`/fixtures?id=${apiFixtureId}`),
    apiFootballRequest<ApiFootballStatisticRow[]>(`/fixtures/statistics?fixture=${apiFixtureId}`),
    apiFootballRequest<ApiFootballEvent[]>(`/fixtures/events?fixture=${apiFixtureId}`)
  ])

  const fixture = fixtureRows[0]

  if (!fixture) {
    throw new Error('No fixture found for this API fixture ID')
  }

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
    score: getBestScore(fixture),
    statistics: statisticsRows.map((row) => ({
      teamId: row.team.id,
      teamName: row.team.name,
      teamLogo: row.team.logo,
      statistics: row.statistics
    })),
    events: eventRows.map((event) => ({
      elapsed: event.time.elapsed,
      extra: event.time.extra,
      teamName: event.team.name,
      playerName: event.player.name,
      assistName: event.assist.name,
      type: event.type,
      detail: event.detail
    }))
  }
}
export async function fetchApiFootballWorldCup2026Fixtures() {
  return apiFootballRequest<ApiFootballWorldCupFixture[]>(
    '/fixtures?league=1&season=2026&timezone=Asia/Kathmandu'
  )
}
