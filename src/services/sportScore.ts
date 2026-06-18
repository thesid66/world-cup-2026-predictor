import type { Fixture } from '../types/tournament'
import type {
  RealMatchData,
  RealMatchEvent,
  RealMatchLineupPlayer,
  RealMatchLineups,
  RealMatchStatistic,
  RealMatchStatus,
  RealMatchTeamStatistics
} from '../types/realMatch'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const SPORT_SCORE_PROXY_URL = `${SUPABASE_URL}/functions/v1/sportscore-match`
const REQUIRED_COMPETITION = 'FIFA World Cup'

const sportScoreMatchSlugAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo',
  'cabo-verde': 'cape-verde',
  'ir-iran': 'iran'
}

const sportScoreComparableTeamAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'republic-of-korea': 'south-korea',
  'united-states': 'usa',
  'united-states-of-america': 'usa',
  'bosnia-and-herzegovina': 'bosnia-herzegovina',
  'congo-dr': 'democratic-republic-of-the-congo',
  'dr-congo': 'democratic-republic-of-the-congo',
  'cabo-verde': 'cape-verde',
  'ir-iran': 'iran',
  'czech-republic': 'czechia',
  'cote-d-ivoire': 'ivory-coast'
}

type SportScoreMatch = {
  home: string
  away: string
  competition?: string
  home_logo?: string
  away_logo?: string
  home_score: number | null
  away_score: number | null
  status: string
  status_text: string
  live_minute: number | null
  incidents?: unknown[]
  stats?: unknown
  statistics?: unknown
  lineups?: unknown
}

type SportScoreMatchResponse = {
  available?: true
  match: SportScoreMatch
  updated: string
}

type SportScoreUnavailableResponse = {
  available: false
  error?: string
  upstreamStatus?: number
  slug?: string
  competition?: string
  requiredCompetition?: string
}

type SportScoreProxyResponse = SportScoreMatchResponse | SportScoreUnavailableResponse

function getSportScoreTeamSlug(teamId: string) {
  return sportScoreMatchSlugAliases[teamId] ?? teamId
}

function getComparableTeamSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sportScoreComparableTeamAliases[slug] ?? slug
}

function shouldReverseTeamOrder(match: SportScoreMatch, fixture: Fixture) {
  const fixtureHome = getComparableTeamSlug(getSportScoreTeamSlug(fixture.homeTeamId))
  const fixtureAway = getComparableTeamSlug(getSportScoreTeamSlug(fixture.awayTeamId))
  const matchHome = getComparableTeamSlug(match.home)
  const matchAway = getComparableTeamSlug(match.away)

  return matchHome === fixtureAway && matchAway === fixtureHome
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
    return readTextValue(
      readFirstValue(value, [
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
    )
  }

  return ''
}

function readFirstTextValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (!(key in row)) continue

    const text = readTextValue(row[key])

    if (text) {
      return text
    }
  }

  return undefined
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function toOptionalNumber(value: unknown): number | null | undefined {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
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

function normalizeSportScoreStatus(
  status: string,
  statusText: string,
  liveMinute: number | null
): RealMatchStatus {
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

    statistics.push({
      type,
      value: toStatisticValue(
        readFirstValue(row, ['value', 'display', 'total', 'count', 'stat_value', 'statValue'])
      )
    })
  })

  return statistics
}

function getStatsRows(rawStats: unknown) {
  if (Array.isArray(rawStats)) {
    return rawStats
  }

  if (isRecord(rawStats)) {
    const rows = readFirstValue(rawStats, ['stats', 'statistics', 'data', 'rows', 'items'])

    if (Array.isArray(rows)) {
      return rows
    }
  }

  return []
}

function normalizeObjectTeamStats(
  statsObject: Record<string, unknown>,
  match: SportScoreMatch
): RealMatchTeamStatistics[] {
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

    return [
      {
        teamName: match.home,
        teamLogo: match.home_logo || undefined,
        statistics: keys.map((key) => ({
          type: normalizeStatType(key),
          value: toStatisticValue(homeRaw[key])
        }))
      },
      {
        teamName: match.away,
        teamLogo: match.away_logo || undefined,
        statistics: keys.map((key) => ({
          type: normalizeStatType(key),
          value: toStatisticValue(awayRaw[key])
        }))
      }
    ].filter((team) => team.statistics.length)
  }

  return []
}

function normalizeSportScoreStatistics(match: SportScoreMatch): RealMatchTeamStatistics[] {
  const rawStats = match.stats ?? match.statistics

  if (isRecord(rawStats)) {
    const objectTeamStats = normalizeObjectTeamStats(rawStats, match)

    if (objectTeamStats.length) {
      return objectTeamStats
    }
  }

  const rows = getStatsRows(rawStats)
  const homeStats: RealMatchStatistic[] = []
  const awayStats: RealMatchStatistic[] = []

  rows.forEach((row) => {
    if (Array.isArray(row)) {
      const type = normalizeStatType(row[0])

      if (!type) return

      homeStats.push({ type, value: toStatisticValue(row[1]) })
      awayStats.push({ type, value: toStatisticValue(row[2]) })
      return
    }

    if (!isRecord(row)) return

    const groupedStats = readFirstValue(row, ['statistics', 'stats'])

    if (Array.isArray(groupedStats)) {
      const teamName = readTextValue(readFirstValue(row, ['teamName', 'team_name', 'team', 'name']))
      const statistics = normalizeTeamStatRows(groupedStats)

      if (statistics.length) {
        const targetStats = teamName.toLowerCase() === match.home.toLowerCase() ? homeStats : awayStats
        targetStats.push(...statistics)
      }

      return
    }

    const type = normalizeStatType(
      readFirstValue(row, ['type', 'name', 'key', 'label', 'title', 'stat', 'stat_type'])
    )

    if (!type) return

    homeStats.push({
      type,
      value: toStatisticValue(
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
    })

    awayStats.push({
      type,
      value: toStatisticValue(
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
    })
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

function normalizeLineupPlayer(value: unknown): RealMatchLineupPlayer | null {
  if (!isRecord(value)) return null

  const name = readFirstTextValue(value, ['name', 'player', 'playerName', 'player_name'])

  if (!name) return null

  return {
    name,
    number: readFirstValue(value, ['number', 'shirt_number', 'shirtNumber']) as number | string | null | undefined,
    position: readFirstTextValue(value, ['position', 'pos', 'role']),
    captain: toOptionalBoolean(readFirstValue(value, ['captain', 'is_captain', 'isCaptain'])),
    rating: readFirstValue(value, ['rating', 'rate']) as string | number | null | undefined
  }
}

function normalizeLineupPlayers(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeLineupPlayer).filter((player): player is RealMatchLineupPlayer => Boolean(player))
}

function normalizeSportScoreLineups(match: SportScoreMatch): RealMatchLineups | undefined {
  if (!isRecord(match.lineups)) {
    return undefined
  }

  return {
    confirmed: toOptionalBoolean(readFirstValue(match.lineups, ['confirmed'])),
    homeFormation: readFirstTextValue(match.lineups, ['home_formation', 'homeFormation']) ?? null,
    awayFormation: readFirstTextValue(match.lineups, ['away_formation', 'awayFormation']) ?? null,
    homeCoach: readFirstTextValue(match.lineups, ['home_coach', 'homeCoach']) ?? null,
    awayCoach: readFirstTextValue(match.lineups, ['away_coach', 'awayCoach']) ?? null,
    homeXi: normalizeLineupPlayers(readFirstValue(match.lineups, ['home_xi', 'homeXi'])),
    awayXi: normalizeLineupPlayers(readFirstValue(match.lineups, ['away_xi', 'awayXi'])),
    homeSubs: normalizeLineupPlayers(readFirstValue(match.lineups, ['home_subs', 'homeSubs'])),
    awaySubs: normalizeLineupPlayers(readFirstValue(match.lineups, ['away_subs', 'awaySubs']))
  }
}

function alignTeamStatistics(statistics: RealMatchTeamStatistics[], reverseTeamOrder: boolean) {
  return reverseTeamOrder ? [...statistics].reverse() : statistics
}

function alignLineups(lineups: RealMatchLineups | undefined, reverseTeamOrder: boolean): RealMatchLineups | undefined {
  if (!lineups || !reverseTeamOrder) {
    return lineups
  }

  return {
    confirmed: lineups.confirmed,
    homeFormation: lineups.awayFormation,
    awayFormation: lineups.homeFormation,
    homeCoach: lineups.awayCoach,
    awayCoach: lineups.homeCoach,
    homeXi: lineups.awayXi,
    awayXi: lineups.homeXi,
    homeSubs: lineups.awaySubs,
    awaySubs: lineups.homeSubs
  }
}

function readIncidentScore(incident: Record<string, unknown>, reverseTeamOrder: boolean) {
  const score = readFirstTextValue(incident, ['score', 'scoreDisplay', 'score_display', 'result'])

  if (score) {
    return score
  }

  const homeScore = readFirstValue(incident, ['home_score', 'homeScore', 'home_team_score'])
  const awayScore = readFirstValue(incident, ['away_score', 'awayScore', 'away_team_score'])

  if (homeScore !== undefined && awayScore !== undefined) {
    return reverseTeamOrder ? `${awayScore} - ${homeScore}` : `${homeScore} - ${awayScore}`
  }

  return undefined
}

function normalizeIncidentTeamName(
  teamValue: unknown,
  match: SportScoreMatch,
  reverseTeamOrder: boolean
) {
  const teamText = readTextValue(teamValue)
  const normalizedTeamText = teamText.toLowerCase()

  if (['home', 'local', 'home team', 'local team'].includes(normalizedTeamText)) {
    return reverseTeamOrder ? match.away : match.home
  }

  if (['away', 'visitor', 'away team', 'visitor team'].includes(normalizedTeamText)) {
    return reverseTeamOrder ? match.home : match.away
  }

  if (!teamText || !reverseTeamOrder) {
    return teamText || undefined
  }

  if (getComparableTeamSlug(teamText) === getComparableTeamSlug(match.home)) {
    return match.away
  }

  if (getComparableTeamSlug(teamText) === getComparableTeamSlug(match.away)) {
    return match.home
  }

  return teamText
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

function normalizeSportScoreEvents(match: SportScoreMatch, reverseTeamOrder: boolean): RealMatchEvent[] {
  if (!Array.isArray(match.incidents)) {
    return []
  }

  const events: RealMatchEvent[] = []

  match.incidents.forEach((incident) => {
    if (!isRecord(incident)) return

    const type = readFirstTextValue(incident, [
      'type',
      'type_name',
      'typeName',
      'incident_type',
      'incidentType',
      'kind',
      'name',
      'event'
    ]) ?? ''

    const playerName = readFirstTextValue(incident, [
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

    const secondaryPlayerName = readFirstTextValue(incident, [
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

    const assistName = readFirstTextValue(incident, [
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

    const teamName = normalizeIncidentTeamName(teamValue, match, reverseTeamOrder)
    const detail = readFirstTextValue(incident, ['detail', 'text', 'description', 'comment', 'reason']) ?? ''
    const scoreDisplay = readIncidentScore(incident, reverseTeamOrder)

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

function isAvailableMatchResponse(data: SportScoreProxyResponse): data is SportScoreMatchResponse {
  return 'match' in data && isRecord(data.match)
}

function assertFifaWorldCupCompetition(match: SportScoreMatch) {
  const competition = String(match.competition ?? '').trim()

  if (competition !== REQUIRED_COMPETITION) {
    throw new Error(
      competition
        ? `SportScore match ignored because competition is ${competition}, not ${REQUIRED_COMPETITION}.`
        : `SportScore match ignored because competition is not ${REQUIRED_COMPETITION}.`
    )
  }
}

export function getSportScoreFixtureSlugCandidates(fixture: Fixture) {
  const homeSlug = getSportScoreTeamSlug(fixture.homeTeamId)
  const awaySlug = getSportScoreTeamSlug(fixture.awayTeamId)

  return [`${homeSlug}-vs-${awaySlug}`, `${awaySlug}-vs-${homeSlug}`]
}

export function canFetchSportScoreMatchData(fixture: Fixture) {
  return fixture.stage === 'group' && Boolean(fixture.homeTeamId && fixture.awayTeamId)
}

export async function fetchSportScoreMatchData(
  slug: string,
  fixture?: Fixture
): Promise<RealMatchData> {
  if (!SUPABASE_URL) {
    throw new Error('SportScore proxy is not configured.')
  }

  const params = new URLSearchParams({ sport: 'football', slug })
  const response = await fetch(`${SPORT_SCORE_PROXY_URL}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`SportScore match request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as SportScoreProxyResponse

  if (!isAvailableMatchResponse(data)) {
    throw new Error(data.error || 'SportScore match data is not available for this fixture yet.')
  }

  const match = data.match
  assertFifaWorldCupCompetition(match)

  const reverseTeamOrder = fixture ? shouldReverseTeamOrder(match, fixture) : false
  const homeScore = reverseTeamOrder ? match.away_score : match.home_score
  const awayScore = reverseTeamOrder ? match.home_score : match.away_score
  const rawLineups = normalizeSportScoreLineups(match)

  return {
    provider: 'sportscore',
    apiFixtureId: slug,
    fetchedAt: data.updated,
    status: normalizeSportScoreStatus(match.status, match.status_text, match.live_minute),
    homeTeam: {
      name: reverseTeamOrder ? match.away : match.home,
      logo: reverseTeamOrder ? match.away_logo || undefined : match.home_logo || undefined
    },
    awayTeam: {
      name: reverseTeamOrder ? match.home : match.away,
      logo: reverseTeamOrder ? match.home_logo || undefined : match.away_logo || undefined
    },
    score: {
      home: homeScore,
      away: awayScore,
      display: formatScore(homeScore, awayScore)
    },
    statistics: alignTeamStatistics(normalizeSportScoreStatistics(match), reverseTeamOrder),
    events: normalizeSportScoreEvents(match, reverseTeamOrder),
    lineups: alignLineups(rawLineups, reverseTeamOrder)
  }
}

export async function fetchSportScoreMatchDataForFixture(fixture: Fixture): Promise<RealMatchData> {
  if (!canFetchSportScoreMatchData(fixture)) {
    throw new Error('This fixture cannot be fetched from SportScore.')
  }

  const [directSlug, reverseSlug] = getSportScoreFixtureSlugCandidates(fixture)

  try {
    return await fetchSportScoreMatchData(directSlug, fixture)
  } catch {
    return fetchSportScoreMatchData(reverseSlug, fixture)
  }
}
