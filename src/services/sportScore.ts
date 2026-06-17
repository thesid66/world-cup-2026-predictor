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
  stats?: unknown
  statistics?: unknown
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

function readTextValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim()
  }

  if (isRecord(value)) {
    const nestedValue = readFirstValue(value, [
      'name',
      'fullName',
      'full_name',
      'displayName',
      'display_name',
      'teamName',
      'team_name',
      'playerName',
      'player_name',
      'title',
      'label',
      'text',
      'value'
    ])

    return readTextValue(nestedValue)
  }

  return ''
}

function normalizeStatType(value: unknown) {
  const rawType = String(value ?? '').trim()
  const compactType = rawType.toLowerCase().replace(/[^a-z0-9]/g, '')

  const aliases: Record<string, string> = {
    possession: 'Ball Possession',
    ballpossession: 'Ball Possession',
    ballpossessionpercentage: 'Ball Possession',
    possessionpercentage: 'Ball Possession',
    shotsongoal: 'Shots on Goal',
    shotsontarget: 'Shots on Goal',
    shotson: 'Shots on Goal',
    totalshots: 'Total Shots',
    shots: 'Total Shots',
    shot: 'Total Shots',
    corners: 'Corner Kicks',
    corner: 'Corner Kicks',
    cornerkicks: 'Corner Kicks',
    fouls: 'Fouls',
    foul: 'Fouls',
    yellowcard: 'Yellow Cards',
    yellowcards: 'Yellow Cards',
    redcard: 'Red Cards',
    redcards: 'Red Cards',
    offsides: 'Offsides',
    offside: 'Offsides',
    saves: 'Goalkeeper Saves',
    goalkeepersaves: 'Goalkeeper Saves',
    passes: 'Passes',
    accuratepasses: 'Accurate Passes',
    passaccuracy: 'Pass Accuracy'
  }

  return aliases[compactType] ?? rawType
}

function normalizeTeamStatRows(rows: unknown[]): RealMatchStatistic[] {
  const statistics: RealMatchStatistic[] = []

  rows.forEach((row) => {
    if (Array.isArray(row)) {
      const type = normalizeStatType(row[0])

      if (!type) return

      statistics.push({ type, value: toStatisticValue(row[1]) })
      return
    }

    if (!isRecord(row)) return

    const type = normalizeStatType(
      readFirstValue(row, ['type', 'name', 'key', 'label', 'title', 'stat', 'stat_type'])
    )

    if (!type) return

    const value = toStatisticValue(
      readFirstValue(row, ['value', 'display', 'total', 'count', 'stat_value', 'statValue'])
    )

    statistics.push({ type, value })
  })

  return statistics
}

function normalizeStatsObjectToRows(statsObject: Record<string, unknown>) {
  const rows = readFirstValue(statsObject, ['stats', 'statistics', 'data', 'rows', 'items'])

  if (Array.isArray(rows)) {
    return rows
  }

  return null
}

function normalizeObjectTeamStats(statsObject: Record<string, unknown>, match: SportScoreMatch) {
  const homeRaw = readFirstValue(statsObject, [
    'home',
    'homeStats',
    'home_stats',
    'home_statistics',
    'local',
    'localTeam',
    match.home
  ])

  const awayRaw = readFirstValue(statsObject, [
    'away',
    'awayStats',
    'away_stats',
    'away_statistics',
    'visitor',
    'visitorTeam',
    match.away
  ])

  if (Array.isArray(homeRaw) && Array.isArray(awayRaw)) {
    return [
      {
        teamName: match.home,
        teamLogo: match.home_logo || undefined,
        statistics: normalizeTeamStatRows(homeRaw)
      },
      {
        teamName: match.away,
        teamLogo: match.away_logo || undefined,
        statistics: normalizeTeamStatRows(awayRaw)
      }
    ].filter((team) => team.statistics.length)
  }

  if (isRecord(homeRaw) && isRecord(awayRaw)) {
    const keys = Array.from(new Set([...Object.keys(homeRaw), ...Object.keys(awayRaw)]))

    const homeStats = keys.map((key) => ({
      type: normalizeStatType(key),
      value: toStatisticValue(homeRaw[key])
    }))

    const awayStats = keys.map((key) => ({
      type: normalizeStatType(key),
      value: toStatisticValue(awayRaw[key])
    }))

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
    ].filter((team) => team.statistics.length)
  }

  return null
}

function getRawStatsRows(match: SportScoreMatch) {
  const rawStats = match.stats ?? match.statistics

  if (Array.isArray(rawStats)) {
    return rawStats
  }

  if (isRecord(rawStats)) {
    return normalizeStatsObjectToRows(rawStats)
  }

  return null
}

function normalizeSportScoreStatistics(match: SportScoreMatch): RealMatchTeamStatistics[] {
  const rawStats = match.stats ?? match.statistics

  if (isRecord(rawStats)) {
    const objectTeamStats = normalizeObjectTeamStats(rawStats, match)

    if (objectTeamStats?.length) {
      return objectTeamStats
    }
  }

  const statsRows = getRawStatsRows(match)

  if (!Array.isArray(statsRows) || statsRows.length === 0) {
    return []
  }

  const teamGroupedRows = statsRows.filter((row) => {
    if (!isRecord(row)) return false

    return Array.isArray(row.statistics) || Array.isArray(row.stats)
  })

  if (teamGroupedRows.length) {
    const teamStatistics: RealMatchTeamStatistics[] = []

    teamGroupedRows.forEach((row) => {
      if (!isRecord(row)) return

      const teamName = readTextValue(
        readFirstValue(row, ['teamName', 'team_name', 'team', 'name'])
      )

      const statRows = readFirstValue(row, ['statistics', 'stats'])
      const statistics = Array.isArray(statRows) ? normalizeTeamStatRows(statRows) : []

      if (!statistics.length) return

      teamStatistics.push({
        teamName,
        teamLogo: readTextValue(readFirstValue(row, ['teamLogo', 'team_logo', 'logo'])) || undefined,
        statistics
      })
    })

    return teamStatistics
  }

  const homeStats: RealMatchStatistic[] = []
  const awayStats: RealMatchStatistic[] = []

  statsRows.forEach((row) => {
    if (Array.isArray(row)) {
      const type = normalizeStatType(row[0])

      if (!type) return

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

function toOptionalNumber(value: unknown): number | null | undefined {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
}

function readIncidentText(incident: Record<string, unknown>, keys: string[]) {
  return readTextValue(readFirstValue(incident, keys)) || undefined
}

function readIncidentScore(incident: Record<string, unknown>) {
  const score = readIncidentText(incident, ['score', 'scoreDisplay', 'score_display', 'result'])

  if (score) {
    return score
  }

  const homeScore = readFirstValue(incident, ['home_score', 'homeScore', 'home_team_score'])
  const awayScore = readFirstValue(incident, ['away_score', 'awayScore', 'away_team_score'])

  if (homeScore !== undefined && awayScore !== undefined) {
    return `${homeScore} - ${awayScore}`
  }

  return undefined
}

function normalizeIncidentTeamName(teamValue: unknown, match: SportScoreMatch) {
  const teamText = readTextValue(teamValue)
  const normalizedTeamText = teamText.toLowerCase()

  if (['home', 'local', 'home team', 'local team'].includes(normalizedTeamText)) {
    return match.home
  }

  if (['away', 'visitor', 'away team', 'visitor team'].includes(normalizedTeamText)) {
    return match.away
  }

  return teamText || undefined
}

function buildEventDisplayText(type: string, playerName?: string, secondaryPlayerName?: string) {
  const normalizedType = type.toLowerCase()

  if (normalizedType.includes('substitution')) {
    if (playerName && secondaryPlayerName) {
      return `${secondaryPlayerName} → ${playerName}`
    }

    return playerName || secondaryPlayerName
  }

  return playerName
}

function normalizeSportScoreEvents(match: SportScoreMatch): RealMatchEvent[] {
  if (!Array.isArray(match.incidents)) {
    return []
  }

  const events: RealMatchEvent[] = []

  match.incidents.forEach((incident) => {
    if (!isRecord(incident)) return

    const type = readIncidentText(incident, [
      'type',
      'type_name',
      'typeName',
      'incident_type',
      'incidentType',
      'kind',
      'name',
      'event'
    ]) ?? ''

    const playerName = readIncidentText(incident, [
      'player',
      'playerName',
      'player_name',
      'player1',
      'player_1',
      'main_player',
      'mainPlayer',
      'in_player',
      'inPlayer',
      'player_in',
      'playerIn',
      'subIn',
      'sub_in',
      'player_in_name',
      'in_name'
    ])

    const secondaryPlayerName = readIncidentText(incident, [
      'secondaryPlayer',
      'secondary_player',
      'player2',
      'player_2',
      'related_player',
      'relatedPlayer',
      'out_player',
      'outPlayer',
      'player_out',
      'playerOut',
      'subOut',
      'sub_out',
      'player_out_name',
      'out_name'
    ])

    const assistName = readIncidentText(incident, [
      'assist',
      'assistName',
      'assist_name',
      'assist_player',
      'assistPlayer',
      'assist_player_name'
    ])

    const teamValue = readFirstValue(incident, [
      'team',
      'teamName',
      'team_name',
      'team_name_en',
      'teamNameEn',
      'side',
      'position',
      'team_type',
      'teamType'
    ])

    const teamName = normalizeIncidentTeamName(teamValue, match)
    const detail = readIncidentText(incident, ['detail', 'text', 'description', 'comment', 'reason']) ?? ''
    const scoreDisplay = readIncidentScore(incident)

    if (!type && !playerName && !secondaryPlayerName && !detail) return

    events.push({
      elapsed: toOptionalNumber(readFirstValue(incident, ['minute', 'elapsed', 'time'])),
      extra: toOptionalNumber(readFirstValue(incident, ['extra', 'extra_time', 'addedTime'])),
      teamName,
      playerName,
      secondaryPlayerName,
      assistName,
      type,
      detail,
      scoreDisplay,
      displayText: buildEventDisplayText(type, playerName, secondaryPlayerName)
    })
  })

  return events
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
