import { teams } from '../data/teams'
import type {
  RealMatchData,
  RealMatchEvent,
  RealMatchLineups,
  RealMatchStatistic,
  RealMatchStatus,
  RealMatchTeamStatistics
} from '../types/realMatch'
import type { Fixture, Team } from '../types/tournament'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const ESPN_SCOREBOARD_PROXY_URL = `${SUPABASE_URL}/functions/v1/espn-worldcup-scoreboard`
const REQUIRED_LEAGUE_SLUG = 'fifa.world'
const REQUIRED_SEASON_YEAR = 2026
const TOURNAMENT_UTC_OFFSET_MS = 4 * 60 * 60 * 1000

const teamById = new Map(teams.map((team) => [team.id, team]))

const comparableTeamAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'republic-of-korea': 'south-korea',
  'united-states': 'usa',
  'united-states-of-america': 'usa',
  'bosnia-and-herzegovina': 'bosnia-herzegovina',
  'bosnia-herz': 'bosnia-herzegovina',
  'bosnia-herzegovina': 'bosnia-herzegovina',
  turkiye: 'turkey',
  'turkiye-national-football-team': 'turkey',
  'cote-divoire': 'ivory-coast',
  'cote-d-ivoire': 'ivory-coast',
  'ivory-coast': 'ivory-coast',
  curacao: 'curacao',
  curaçao: 'curacao',
  'cabo-verde': 'cape-verde',
  'cape-verde': 'cape-verde',
  'ir-iran': 'iran',
  iran: 'iran',
  'congo-dr': 'dr-congo',
  'dr-congo': 'dr-congo',
  'democratic-republic-of-the-congo': 'dr-congo',
  czechia: 'czechia',
  'czech-republic': 'czechia',
  haiti: 'haiti',
  hai: 'haiti',
  hti: 'haiti'
}

type EspnScoreboardProxyResponse =
  | {
      available: true
      source: 'espn'
      fetchedAt: string
      data: EspnScoreboardPayload
    }
  | {
      available: false
      status?: number
      source?: 'espn'
      error?: unknown
    }

type EspnScoreboardPayload = {
  leagues?: EspnLeague[]
  events?: EspnEvent[]
}

type EspnLeague = {
  slug?: string
  season?: {
    year?: number | string
  }
}

type EspnEvent = {
  id?: string
  uid?: string
  date?: string
  name?: string
  shortName?: string
  season?: {
    year?: number | string
    slug?: string
  }
  competitions?: EspnCompetition[]
}

type EspnCompetition = {
  id?: string
  date?: string
  startDate?: string
  altGameNote?: string
  status?: EspnCompetitionStatus
  venue?: {
    fullName?: string
    displayName?: string
    address?: {
      city?: string
      country?: string
    }
  }
  competitors?: EspnCompetitor[]
  details?: EspnCompetitionDetail[]
}

type EspnCompetitionStatus = {
  clock?: number
  displayClock?: string
  period?: number
  type?: {
    name?: string
    state?: string
    completed?: boolean
    description?: string
    detail?: string
    shortDetail?: string
  }
}

type EspnCompetitor = {
  id?: string
  homeAway?: 'home' | 'away' | string
  score?: string
  team?: {
    id?: string
    abbreviation?: string
    displayName?: string
    shortDisplayName?: string
    name?: string
    location?: string
    logo?: string
  }
  statistics?: Array<{
    name?: string
    abbreviation?: string
    displayValue?: string
    value?: number | string
  }>
}

type EspnCompetitionDetail = {
  type?: {
    text?: string
  }
  clock?: {
    value?: number
    displayValue?: string
  }
  team?: {
    id?: string
  }
  scoreValue?: number
  scoringPlay?: boolean
  yellowCard?: boolean
  redCard?: boolean
  penaltyKick?: boolean
  ownGoal?: boolean
  athletesInvolved?: Array<{
    displayName?: string
    fullName?: string
    shortName?: string
    team?: {
      id?: string
    }
  }>
}

function getTeam(teamId: string) {
  return teamById.get(teamId)
}

function normalizeComparableText(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return comparableTeamAliases[normalized] ?? normalized
}

function getComparableTeamTokens(team: Team | undefined) {
  if (!team) return []

  return [team.id, team.name, team.shortName].map(normalizeComparableText)
}

function getComparableCompetitorTokens(competitor: EspnCompetitor | undefined) {
  if (!competitor?.team) return []

  return [
    competitor.team.displayName,
    competitor.team.shortDisplayName,
    competitor.team.name,
    competitor.team.location,
    competitor.team.abbreviation
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeComparableText)
}

function tokensOverlap(a: string[], b: string[]) {
  return a.some((token) => b.includes(token))
}

function getEspnDateParam(fixture: Fixture) {
  return fixture.date.replace(/[^0-9]/g, '')
}

function getTournamentDateFromEspnEventDate(value: string) {
  const utcTime = Date.parse(value)

  if (Number.isNaN(utcTime)) {
    return ''
  }

  return new Date(utcTime - TOURNAMENT_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

function getEventTournamentDate(event: EspnEvent, competition: EspnCompetition) {
  return getTournamentDateFromEspnEventDate(
    String(event.date ?? competition.date ?? competition.startDate ?? '')
  )
}

function isValidWorldCupPayload(payload: EspnScoreboardPayload) {
  return payload.leagues?.some((league) => {
    const seasonYear = Number(league.season?.year)

    return league.slug === REQUIRED_LEAGUE_SLUG && seasonYear === REQUIRED_SEASON_YEAR
  })
}

function getPrimaryCompetition(event: EspnEvent) {
  return event.competitions?.[0]
}

function getHomeCompetitor(competition: EspnCompetition) {
  return competition.competitors?.find((competitor) => competitor.homeAway === 'home')
}

function getAwayCompetitor(competition: EspnCompetition) {
  return competition.competitors?.find((competitor) => competitor.homeAway === 'away')
}

function eventMatchesFixture(event: EspnEvent, fixture: Fixture) {
  if (Number(event.season?.year) !== REQUIRED_SEASON_YEAR) {
    return false
  }

  const competition = getPrimaryCompetition(event)

  if (!competition?.altGameNote?.includes('FIFA World Cup')) {
    return false
  }

  if (getEventTournamentDate(event, competition) !== fixture.date) {
    return false
  }

  const fixtureHomeTokens = getComparableTeamTokens(getTeam(fixture.homeTeamId))
  const fixtureAwayTokens = getComparableTeamTokens(getTeam(fixture.awayTeamId))
  const eventHomeTokens = getComparableCompetitorTokens(getHomeCompetitor(competition))
  const eventAwayTokens = getComparableCompetitorTokens(getAwayCompetitor(competition))

  return (
    tokensOverlap(fixtureHomeTokens, eventHomeTokens) && tokensOverlap(fixtureAwayTokens, eventAwayTokens)
  ) || (
    tokensOverlap(fixtureHomeTokens, eventAwayTokens) && tokensOverlap(fixtureAwayTokens, eventHomeTokens)
  )
}

function shouldReverseTeamOrder(event: EspnEvent, fixture: Fixture) {
  const competition = getPrimaryCompetition(event)

  if (!competition) return false

  const fixtureHomeTokens = getComparableTeamTokens(getTeam(fixture.homeTeamId))
  const eventAwayTokens = getComparableCompetitorTokens(getAwayCompetitor(competition))

  return tokensOverlap(fixtureHomeTokens, eventAwayTokens)
}

function parseScore(value: string | undefined) {
  const score = Number(value)

  return Number.isFinite(score) ? score : null
}

function formatScore(home: number | null, away: number | null) {
  if (home === null || away === null) {
    return '-'
  }

  return `${home} - ${away}`
}

function parseElapsedFromClock(displayClock: string | undefined) {
  if (!displayClock) return null

  const match = displayClock.match(/^(\d+)/)

  if (!match) return null

  const elapsed = Number(match[1])

  return Number.isFinite(elapsed) ? elapsed : null
}

function normalizeEspnStatus(status: EspnCompetitionStatus | undefined): RealMatchStatus {
  const type = status?.type
  const state = type?.state
  const shortDetail = type?.shortDetail || type?.detail

  if (type?.completed || state === 'post') {
    return {
      long: type?.description || 'Full Time',
      short: shortDetail || 'FT',
      elapsed: null
    }
  }

  if (state === 'in') {
    return {
      long: type?.description || type?.detail || 'Live',
      short: shortDetail || 'LIVE',
      elapsed: parseElapsedFromClock(status?.displayClock)
    }
  }

  return {
    long: type?.description || type?.detail || 'Not started',
    short: shortDetail || 'NS',
    elapsed: null
  }
}

function hasCompetitionStarted(status: EspnCompetitionStatus | undefined) {
  const state = status?.type?.state

  return state === 'in' || state === 'post' || Boolean(status?.type?.completed)
}

function normalizeStatName(stat: { name?: string; abbreviation?: string }) {
  const compact = String(stat.name || stat.abbreviation || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const aliases: Record<string, string> = {
    possessionpct: 'Ball Possession',
    possession: 'Ball Possession',
    shotstarget: 'Shots on Goal',
    shotsontarget: 'Shots on Goal',
    sog: 'Shots on Goal',
    totalshots: 'Total Shots',
    shots: 'Total Shots',
    shot: 'Total Shots',
    woncorners: 'Corner Kicks',
    corners: 'Corner Kicks',
    cornerkicks: 'Corner Kicks',
    foulscommitted: 'Fouls',
    fouls: 'Fouls',
    yellowcards: 'Yellow Cards',
    redcards: 'Red Cards',
    goalassists: 'Assists',
    assists: 'Assists'
  }

  return aliases[compact] ?? stat.name ?? stat.abbreviation ?? 'Statistic'
}

function normalizeCompetitorStatistics(competitor: EspnCompetitor | undefined): RealMatchStatistic[] {
  if (!competitor?.statistics?.length) return []

  return competitor.statistics
    .map((stat) => ({
      type: normalizeStatName(stat),
      value: stat.displayValue ?? stat.value ?? null
    }))
    .filter((stat) => stat.value !== null && stat.value !== undefined)
}

function normalizeEspnStatistics(competition: EspnCompetition, reverseTeamOrder: boolean): RealMatchTeamStatistics[] {
  const home = getHomeCompetitor(competition)
  const away = getAwayCompetitor(competition)

  const homeStats = normalizeCompetitorStatistics(home)
  const awayStats = normalizeCompetitorStatistics(away)

  const stats = [
    {
      teamId: home?.id ?? home?.team?.id,
      teamName: home?.team?.displayName || home?.team?.name || 'Home',
      teamLogo: home?.team?.logo,
      statistics: homeStats
    },
    {
      teamId: away?.id ?? away?.team?.id,
      teamName: away?.team?.displayName || away?.team?.name || 'Away',
      teamLogo: away?.team?.logo,
      statistics: awayStats
    }
  ].filter((team) => team.statistics.length)

  return reverseTeamOrder ? stats.reverse() : stats
}

function getCompetitorByTeamId(competition: EspnCompetition, teamId: string | undefined) {
  return competition.competitors?.find((competitor) => competitor.id === teamId || competitor.team?.id === teamId)
}

function normalizeEventType(detail: EspnCompetitionDetail) {
  const type = detail.type?.text || ''

  if (detail.scoringPlay || type.toLowerCase().includes('goal') || type.toLowerCase().includes('penalty - scored')) {
    return type || 'Goal'
  }

  if (detail.redCard) return type || 'Red Card'
  if (detail.yellowCard) return type || 'Yellow Card'

  return type
}

function normalizeEspnEvents(competition: EspnCompetition): RealMatchEvent[] {
  if (!competition.details?.length) return []

  return competition.details
    .map((detail) => {
      const eventType = normalizeEventType(detail)
      const player = detail.athletesInvolved?.[0]
      const team = getCompetitorByTeamId(competition, detail.team?.id || player?.team?.id)
      const displayClock = detail.clock?.displayValue
      const elapsed = parseElapsedFromClock(displayClock)
      const detailParts = [
        detail.penaltyKick ? 'Penalty' : '',
        detail.ownGoal ? 'Own goal' : ''
      ].filter(Boolean)

      return {
        elapsed,
        teamName: team?.team?.displayName || team?.team?.name,
        teamLogo: team?.team?.logo,
        playerName: player?.displayName || player?.fullName || player?.shortName,
        type: eventType,
        detail: detailParts.join(' · '),
        displayText: player?.displayName || player?.fullName || player?.shortName
      }
    })
    .filter((event) => event.type || event.playerName || event.detail)
}

function buildEmptyLineups(): RealMatchLineups | undefined {
  return undefined
}

function normalizeEspnMatchData(event: EspnEvent, fixture: Fixture, fetchedAt: string): RealMatchData {
  const competition = getPrimaryCompetition(event)

  if (!competition) {
    throw new Error('ESPN event has no competition payload.')
  }

  const reverseTeamOrder = shouldReverseTeamOrder(event, fixture)
  const home = getHomeCompetitor(competition)
  const away = getAwayCompetitor(competition)
  const displayHome = reverseTeamOrder ? away : home
  const displayAway = reverseTeamOrder ? home : away
  const status = normalizeEspnStatus(competition.status)
  const hasStarted = hasCompetitionStarted(competition.status)
  const homeScore = hasStarted ? parseScore(displayHome?.score) : null
  const awayScore = hasStarted ? parseScore(displayAway?.score) : null

  return {
    provider: 'espn',
    apiFixtureId: event.id || competition.id || fixture.id,
    fetchedAt,
    status,
    homeTeam: {
      id: displayHome?.id ?? displayHome?.team?.id,
      name: displayHome?.team?.displayName || displayHome?.team?.name || getTeam(fixture.homeTeamId)?.name || 'Home',
      logo: displayHome?.team?.logo
    },
    awayTeam: {
      id: displayAway?.id ?? displayAway?.team?.id,
      name: displayAway?.team?.displayName || displayAway?.team?.name || getTeam(fixture.awayTeamId)?.name || 'Away',
      logo: displayAway?.team?.logo
    },
    score: {
      home: homeScore,
      away: awayScore,
      display: formatScore(homeScore, awayScore)
    },
    statistics: normalizeEspnStatistics(competition, reverseTeamOrder),
    events: normalizeEspnEvents(competition),
    lineups: buildEmptyLineups()
  }
}

function getProxyErrorMessage(error: unknown) {
  if (typeof error === 'string') return error

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'ESPN data is not available.')
  }

  return 'ESPN data is not available for this fixture yet.'
}

export function canFetchEspnWorldCupMatchData(fixture: Fixture) {
  return fixture.stage === 'group' && Boolean(fixture.homeTeamId && fixture.awayTeamId && fixture.date)
}

export async function fetchEspnWorldCupMatchDataForFixture(fixture: Fixture): Promise<RealMatchData> {
  if (!canFetchEspnWorldCupMatchData(fixture)) {
    throw new Error('ESPN World Cup data is not available for this fixture yet.')
  }

  if (!SUPABASE_URL) {
    throw new Error('ESPN World Cup proxy is not configured.')
  }

  const params = new URLSearchParams({ dates: getEspnDateParam(fixture) })
  const response = await fetch(`${ESPN_SCOREBOARD_PROXY_URL}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`ESPN World Cup request failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as EspnScoreboardProxyResponse

  if (!payload.available) {
    throw new Error(getProxyErrorMessage(payload.error))
  }

  if (!isValidWorldCupPayload(payload.data)) {
    throw new Error('ESPN payload did not identify FIFA World Cup 2026.')
  }

  const event = payload.data.events?.find((candidate) => eventMatchesFixture(candidate, fixture))

  if (!event) {
    throw new Error('ESPN World Cup data is not available for this fixture yet.')
  }

  return normalizeEspnMatchData(event, fixture, payload.fetchedAt)
}
