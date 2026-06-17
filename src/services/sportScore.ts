import type { Fixture } from '../types/tournament'
import type { RealMatchData, RealMatchStatus } from '../types/realMatch'

const SPORT_SCORE_BASE_URL = 'https://sportscore.com'
const SPORT_SCORE_SOURCE = 'wcpredict26'

const sportScoreMatchSlugAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo',
  'cabo-verde': 'cape-verde',
  'ir-iran': 'iran'
}

type SportScoreMatchResponse = {
  match: {
    home: string
    away: string
    home_logo: string
    away_logo: string
    home_score: number | null
    away_score: number | null
    status: string
    status_text: string
    live_minute: number | null
    incidents?: unknown[]
    stats?: unknown[]
  }
  updated: string
}

function getSportScoreTeamSlug(teamId: string) {
  return sportScoreMatchSlugAliases[teamId] ?? teamId
}

function normalizeSportScoreStatus(status: string, statusText: string, liveMinute: number | null): RealMatchStatus {
  const normalized = status.toLowerCase()

  if (normalized === 'live') {
    return { long: statusText || 'Live', short: 'LIVE', elapsed: liveMinute }
  }

  if (normalized === 'finished') {
    return { long: statusText || 'Finished', short: 'FT', elapsed: null }
  }

  if (normalized === 'postponed') {
    return { long: statusText || 'Postponed', short: 'PST', elapsed: null }
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return { long: statusText || 'Cancelled', short: 'CANC', elapsed: null }
  }

  return { long: statusText || 'Not started', short: 'NS', elapsed: null }
}

function formatScore(home: number | null, away: number | null) {
  if (home === null || away === null) {
    return '-'
  }

  return `${home} - ${away}`
}

export function getSportScoreFixtureSlugCandidates(fixture: Fixture) {
  const homeSlug = getSportScoreTeamSlug(fixture.homeTeamId)
  const awaySlug = getSportScoreTeamSlug(fixture.awayTeamId)

  return [`${homeSlug}-vs-${awaySlug}`, `${awaySlug}-vs-${homeSlug}`]
}

export function canFetchSportScoreMatchData(fixture: Fixture) {
  return fixture.stage === 'group' && Boolean(fixture.homeTeamId && fixture.awayTeamId)
}

export async function fetchSportScoreMatchData(slug: string): Promise<RealMatchData> {
  const params = new URLSearchParams({ sport: 'football', slug, src: SPORT_SCORE_SOURCE })
  const response = await fetch(`${SPORT_SCORE_BASE_URL}/api/widget/match/?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`SportScore match request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as SportScoreMatchResponse
  const match = data.match

  return {
    provider: 'sportscore',
    apiFixtureId: slug,
    fetchedAt: data.updated,
    status: normalizeSportScoreStatus(match.status, match.status_text, match.live_minute),
    homeTeam: { name: match.home, logo: match.home_logo || undefined },
    awayTeam: { name: match.away, logo: match.away_logo || undefined },
    score: {
      home: match.home_score,
      away: match.away_score,
      display: formatScore(match.home_score, match.away_score)
    },
    statistics: [],
    events: []
  }
}

export async function fetchSportScoreMatchDataForFixture(fixture: Fixture): Promise<RealMatchData> {
  if (!canFetchSportScoreMatchData(fixture)) {
    throw new Error('This fixture cannot be fetched from SportScore.')
  }

  const [directSlug, reverseSlug] = getSportScoreFixtureSlugCandidates(fixture)

  try {
    return await fetchSportScoreMatchData(directSlug)
  } catch {
    return fetchSportScoreMatchData(reverseSlug)
  }
}
