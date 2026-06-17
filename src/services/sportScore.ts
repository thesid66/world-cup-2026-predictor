import type { Fixture } from '../types/tournament'
import type {
  RealMatchData,
  RealMatchEvent,
  RealMatchStatistic,
  RealMatchStatus,
  RealMatchTeamStatistics
} from '../types/realMatch'

const SPORT_SCORE_BASE_URL = 'https://sportscore.com'
const SPORT_SCORE_SOURCE = 'wcpredict26'

const sportScoreMatchSlugAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo',
  'cabo-verde': 'cape-verde',
  'ir-iran': 'iran'
}

type SportScoreMatch = {
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

type SportScoreMatchResponse = {
  match: SportScoreMatch
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStatisticValue(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value === null || value === undefined) {
    return null
  }

  if (isRecord(value)) {
    return toStatisticValue(
      value.value ?? value.display ?? value.total ?? value.count ?? value.name ?? value.text
    )
  }

  return String(value)
}

function readFirstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key]
    }
  }

  return undefined
}

function normalizeStatType(value: unknown) {
  const rawType = String(value ?? '').trim()
  const compactType = rawType.toLowerCase().replace(/[^a-z0-9]/g, '')

  const aliases: Record<string, string> = {
    possession: 'Ball Possession',
    ballpossession: 'Ball Possession',
    ballpossessionpercentage: 'Ball Possession',
    shotsongoal: 'Shots on Goal',
    shotsongoal: 'Shots on Goal',
    shotsontarget: 'Shots on Goal',
    totalshots: 'Total Shots',
    shots: 'Total Shots',
    corners: 'Corner Kicks',
    corner: 'Corner Kicks',
    cornerkicks: 'Corner Kicks',
    fouls: 'Fouls',
    foul: 'Fouls',
    yellowcard: 'Yellow Cards',
    yellowcards: 'Yellow Cards',
    redcard: 'Red Cards',
    redcards: 'Red Cards'
  }

  return aliases[compactType] ?? rawType
}

function normalizeTeamStatRows(rows: unknown[]): RealMatchStatistic[] {
  return rows
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          type: normalizeStatType(row[0]),
          value: toStatisticValue(row[1])
        }
      }

      if (!isRecord(row)) return null

      const type = normalizeStatType(
        readFirstValue(row, ['type', 'name', 'key', 'label', 'title', 'stat', 'stat_type'])
      )

      if (!type) return null

      const value = toStatisticValue(
        readFirstValue(row, ['value', 'display', 'total', 'count', 'stat_value', 'statValue'])
      )

      return { type, value }
    })
    .filter((stat): stat is RealMatchStatistic => Boolean(stat?.type))
}

function normalizeSportScoreStatistics(match: SportScoreMatch): RealMatchTeamStatistics[] {
  const rawStats = match.stats

  if (!Array.isArray(rawStats) || rawStats.length === 0) {
    return []
  }

  const teamGroupedRows = rawStats.filter((row) => {
    if (!isRecord(row)) return false

    return Array.isArray(row.statistics) || Array.isArray(row.stats)
  })

  if (teamGroupedRows.length) {
    return teamGroupedRows
      .map((row) => {
        if (!isRecord(row)) return null

        const teamName = String(
          readFirstValue(row, ['teamName', 'team_name', 'team', 'name']) ?? ''
        )

        const statRows = readFirstValue(row, ['statistics', 'stats'])
        const statistics = Array.isArray(statRows) ? normalizeTeamStatRows(statRows) : []

        return {
          teamName,
          teamLogo: String(readFirstValue(row, ['teamLogo', 'team_logo', 'logo']) ?? '') || undefined,
          statistics
        }
      })
      .filter((teamStats): teamStats is RealMatchTeamStatistics => Boolean(teamStats?.statistics.length))
  }

  const homeStats: RealMatchStatistic[] = []
  const awayStats: RealMatchStatistic[] = []

  rawStats.forEach((row) => {
    if (Array.isArray(row)) {
      const type = normalizeStatType(row[0])
      homeStats.push({ type, value: toStatisticValue(row[1]) })
      awayStats.push({ type, value: toStatisticValue(row[2]) })
      return
    }

    if (!isRecord(row)) return

    const type = normalizeStatType(
      readFirstValue(row, ['type', 'name', 'key', 'label', 'title', 'stat', 'stat_type'])
    )

    if (!type) return

    const homeValue = toStatisticValue(
      readFirstValue(row, [
        'home',
        'home_value',
        'homeValue',
        'home_stat',
        'homeStat',
        'home_total',
        'homeTotal',
        'local',
        'local_value'
      ])
    )

    const awayValue = toStatisticValue(
      readFirstValue(row, [
        'away',
        'away_value',
        'awayValue',
        'away_stat',
        'awayStat',
        'away_total',
        'awayTotal',
        'visitor',
        'visitor_value'
      ])
    )

    homeStats.push({ type, value: homeValue })
    awayStats.push({ type, value: awayValue })
  })

  if (!homeStats.length && !awayStats.length) {
    return []
  }

  return [
    {
      teamName: match.home,
      teamLogo: match.home_logo || undefined,
      statistics: homeStats
    },
    {
      teamName: match.away,
      teamLogo: match.away_logo || undefined,
      statistics: awayStats
    }
  ]
}

function normalizeSportScoreEvents(match: SportScoreMatch): RealMatchEvent[] {
  if (!Array.isArray(match.incidents)) {
    return []
  }

  return match.incidents
    .map((incident) => {
      if (!isRecord(incident)) return null

      const player = readFirstValue(incident, ['player', 'playerName', 'player_name'])
      const assist = readFirstValue(incident, ['assist', 'assistName', 'assist_name'])
      const team = readFirstValue(incident, ['team', 'teamName', 'team_name'])

      return {
        elapsed: Number(readFirstValue(incident, ['minute', 'elapsed', 'time'])) || null,
        extra: Number(readFirstValue(incident, ['extra', 'extra_time', 'addedTime'])) || null,
        teamName: typeof team === 'string' ? team : undefined,
        playerName: typeof player === 'string' ? player : undefined,
        assistName: typeof assist === 'string' ? assist : undefined,
        type: String(readFirstValue(incident, ['type', 'incident_type', 'kind']) ?? ''),
        detail: String(readFirstValue(incident, ['detail', 'text', 'description']) ?? '')
      }
    })
    .filter((event): event is RealMatchEvent => Boolean(event?.type || event?.playerName))
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
    statistics: normalizeSportScoreStatistics(match),
    events: normalizeSportScoreEvents(match)
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
