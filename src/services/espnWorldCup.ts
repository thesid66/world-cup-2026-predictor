import { teams } from '../data/teams'
import type {
  RealMatchCommentary,
  RealMatchData,
  RealMatchEvent,
  RealMatchLineupPlayer,
  RealMatchLineups,
  RealMatchStatistic,
  RealMatchStatus,
  RealMatchTeamStatistics
} from '../types/realMatch'
import type { Fixture, Team } from '../types/tournament'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const ESPN_PROXY_URL = `${SUPABASE_URL}/functions/v1/espn-worldcup-scoreboard`
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

type EspnProxyResponse<TData, TKind extends 'scoreboard' | 'summary'> =
  | {
      available: true
      source: 'espn'
      kind?: TKind
      fetchedAt: string
      data: TData
    }
  | {
      available: false
      status?: number
      source?: 'espn'
      kind?: TKind
      error?: unknown
    }

type EspnScoreboardPayload = {
  leagues?: EspnLeague[]
  events?: EspnEvent[]
}

type EspnSummaryPayload = {
  header?: {
    competitions?: EspnCompetition[]
  }
  boxscore?: EspnBoxscore
  lineups?: unknown[]
  rosters?: unknown[]
  commentary?: EspnCommentaryItem[]
  plays?: EspnCommentaryItem[]
}

type EspnBoxscore = {
  lineups?: unknown[]
  rosters?: unknown[]
  teams?: unknown[]
  players?: unknown[]
}

type EspnLeague = {
  slug?: string
  season?: {
    year?: number | string
  }
}

type EspnLink = {
  href?: string
  text?: string
  shortText?: string
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
  links?: EspnLink[]
}

type EspnCompetition = {
  id?: string
  date?: string
  startDate?: string
  attendance?: number
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
  broadcasts?: Array<{
    names?: string[]
  }>
  geoBroadcasts?: Array<{
    media?: {
      shortName?: string
    }
  }>
  headlines?: Array<{
    description?: string
    shortLinkText?: string
  }>
  links?: EspnLink[]
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
  form?: string
  records?: Array<{
    summary?: string
    type?: string
    name?: string
  }>
  team?: {
    id?: string
    abbreviation?: string
    displayName?: string
    shortDisplayName?: string
    name?: string
    location?: string
    logo?: string
    color?: string
    alternateColor?: string
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
  shootout?: boolean
  athletesInvolved?: Array<{
    displayName?: string
    fullName?: string
    shortName?: string
    team?: {
      id?: string
    }
  }>
}

type EspnCommentaryItem = {
  id?: string | number
  type?: string
  text?: string
  shortText?: string
  displayValue?: string
  time?: {
    displayValue?: string
  }
  clock?: {
    displayValue?: string
  }
  team?: {
    id?: string
    displayName?: string
  }
  athletesInvolved?: Array<{
    displayName?: string
    fullName?: string
    shortName?: string
  }>
  participants?: Array<{
    athlete?: {
      displayName?: string
      fullName?: string
      shortName?: string
    }
  }>
}

type JsonRecord = Record<string, unknown>

type NormalizedLineupContainer = {
  teamId?: string
  formation: string | null
  coach: string | null
  starters: RealMatchLineupPlayer[]
  substitutes: RealMatchLineupPlayer[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, key: string): JsonRecord | undefined {
  if (!isRecord(value)) return undefined
  const nextValue = value[key]
  return isRecord(nextValue) ? nextValue : undefined
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return []
  const nextValue = value[key]
  return Array.isArray(nextValue) ? nextValue : []
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) return ''
  const nextValue = value[key]
  return typeof nextValue === 'string' || typeof nextValue === 'number' ? String(nextValue).trim() : ''
}

function readBoolean(value: unknown, key: string) {
  if (!isRecord(value)) return false
  return Boolean(value[key])
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
  if (Number(event.season?.year) !== REQUIRED_SEASON_YEAR) return false

  const competition = getPrimaryCompetition(event)

  if (!competition?.altGameNote?.includes('FIFA World Cup')) return false
  if (getEventTournamentDate(event, competition) !== fixture.date) return false

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
  if (home === null || away === null) return '-'
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

  const stats = [
    {
      teamId: home?.id ?? home?.team?.id,
      teamName: home?.team?.displayName || home?.team?.name || 'Home',
      teamLogo: home?.team?.logo,
      statistics: normalizeCompetitorStatistics(home)
    },
    {
      teamId: away?.id ?? away?.team?.id,
      teamName: away?.team?.displayName || away?.team?.name || 'Away',
      teamLogo: away?.team?.logo,
      statistics: normalizeCompetitorStatistics(away)
    }
  ].filter((team) => team.statistics.length)

  return reverseTeamOrder ? stats.reverse() : stats
}

function getCompetitorByTeamId(competition: EspnCompetition, teamId: string | undefined) {
  if (!teamId) return undefined
  return competition.competitors?.find((competitor) => competitor.id === teamId || competitor.team?.id === teamId)
}

function getEventType(detail: EspnCompetitionDetail) {
  const text = detail.type?.text || 'Event'

  if (detail.scoringPlay || /goal|penalty - scored/i.test(text)) return 'Goal'
  if (detail.yellowCard || /yellow/i.test(text)) return 'Yellow Card'
  if (detail.redCard || /red/i.test(text)) return 'Red Card'
  if (/substitution/i.test(text)) return 'Substitution'

  return text
}

function normalizeEspnEvents(competition: EspnCompetition): RealMatchEvent[] {
  return (competition.details ?? [])
    .map((detail) => {
      const type = getEventType(detail)
      const player = detail.athletesInvolved?.[0]
      const secondaryPlayer = detail.athletesInvolved?.[1]
      const team = getCompetitorByTeamId(competition, detail.team?.id ?? player?.team?.id)
      const playerName = player?.displayName || player?.fullName || player?.shortName
      const secondaryPlayerName = secondaryPlayer?.displayName || secondaryPlayer?.fullName || secondaryPlayer?.shortName
      const timeLabel = detail.clock?.displayValue
      const elapsed = detail.clock?.value ?? parseElapsedFromClock(timeLabel)

      return {
        elapsed: typeof elapsed === 'number' ? elapsed : null,
        timeLabel,
        teamName: team?.team?.displayName || team?.team?.name,
        teamLogo: team?.team?.logo,
        playerName,
        secondaryPlayerName,
        type,
        detail: detail.type?.text,
        scoreDisplay: typeof detail.scoreValue === 'number' ? String(detail.scoreValue) : undefined,
        displayText: playerName ? `${type}: ${playerName}` : type
      }
    })
    .filter((event) => event.type || event.playerName || event.detail)
}

function readLineupPlayerName(value: unknown) {
  if (!isRecord(value)) return ''

  const athlete = readRecord(value, 'athlete') ?? readRecord(value, 'player') ?? readRecord(value, 'person')

  return (
    readString(athlete, 'displayName') ||
    readString(athlete, 'fullName') ||
    readString(athlete, 'shortName') ||
    readString(value, 'displayName') ||
    readString(value, 'fullName') ||
    readString(value, 'name')
  )
}

function readLineupPlayerPosition(value: unknown) {
  if (!isRecord(value)) return undefined

  const athlete = readRecord(value, 'athlete') ?? readRecord(value, 'player')
  const position = readRecord(value, 'position') ?? readRecord(athlete, 'position')
  const displayValue =
    readString(position, 'abbreviation') ||
    readString(position, 'displayName') ||
    readString(position, 'name') ||
    readString(value, 'position')

  return displayValue || undefined
}

function normalizeLineupPlayers(values: unknown[]): RealMatchLineupPlayer[] {
  const players: RealMatchLineupPlayer[] = []

  values.forEach((value) => {
    if (!isRecord(value)) return

    const name = readLineupPlayerName(value)
    if (!name) return

    players.push({
      name,
      number:
        readString(value, 'jersey') ||
        readString(value, 'jerseyNumber') ||
        readString(value, 'shirtNumber') ||
        readString(readRecord(value, 'athlete'), 'jersey') ||
        null,
      position: readLineupPlayerPosition(value),
      captain: readBoolean(value, 'captain'),
      rating: readString(value, 'rating') || null
    })
  })

  return players
}

function getLineupTeamId(value: unknown) {
  const team = readRecord(value, 'team')
  return readString(team, 'id') || readString(value, 'teamId')
}

function getLineupFormation(value: unknown) {
  return readString(value, 'formation') || readString(value, 'formationDisplay') || null
}

function getLineupCoach(value: unknown) {
  const coach = readRecord(value, 'coach') ?? readRecord(value, 'manager')
  return readString(coach, 'displayName') || readString(coach, 'name') || null
}

function getLineupPlayersForKeys(value: unknown, keys: string[]) {
  return keys.flatMap((key) => readArray(value, key))
}

function splitGenericPlayers(players: unknown[]) {
  const starters = players.filter((player) => readBoolean(player, 'starter') || readBoolean(player, 'starting'))
  const substitutes = players.filter((player) => readBoolean(player, 'substitute') || readBoolean(player, 'bench'))

  if (starters.length || substitutes.length) {
    return { starters, substitutes }
  }

  return { starters: players, substitutes: [] }
}

function normalizeLineupContainer(value: unknown): NormalizedLineupContainer | undefined {
  const starters = getLineupPlayersForKeys(value, ['starters', 'startingXI', 'startingXi', 'lineup', 'startingLineup'])
  const substitutes = getLineupPlayersForKeys(value, ['substitutes', 'subs', 'bench'])

  if (starters.length || substitutes.length) {
    return {
      teamId: getLineupTeamId(value),
      formation: getLineupFormation(value),
      coach: getLineupCoach(value),
      starters: normalizeLineupPlayers(starters),
      substitutes: normalizeLineupPlayers(substitutes)
    }
  }

  const genericPlayers = getLineupPlayersForKeys(value, ['players'])
  if (!genericPlayers.length) return undefined

  const splitPlayers = splitGenericPlayers(genericPlayers)

  return {
    teamId: getLineupTeamId(value),
    formation: getLineupFormation(value),
    coach: getLineupCoach(value),
    starters: normalizeLineupPlayers(splitPlayers.starters),
    substitutes: normalizeLineupPlayers(splitPlayers.substitutes)
  }
}

function getSummaryLineupContainers(summary?: EspnSummaryPayload): NormalizedLineupContainer[] {
  if (!summary) return []

  const containers = [
    ...readArray(summary, 'lineups'),
    ...readArray(summary, 'rosters'),
    ...readArray(summary.boxscore, 'lineups'),
    ...readArray(summary.boxscore, 'rosters')
  ]

  const lineups: NormalizedLineupContainer[] = []

  containers.forEach((container) => {
    const lineup = normalizeLineupContainer(container)
    if (lineup) lineups.push(lineup)
  })

  return lineups
}

function findLineupForTeam(lineups: NormalizedLineupContainer[], competitor: EspnCompetitor | undefined) {
  const teamId = competitor?.id ?? competitor?.team?.id
  if (!teamId) return undefined
  return lineups.find((lineup) => lineup.teamId === teamId)
}

function normalizeEspnLineups(
  summary: EspnSummaryPayload | undefined,
  competition: EspnCompetition,
  reverseTeamOrder: boolean
): RealMatchLineups | undefined {
  const lineupContainers = getSummaryLineupContainers(summary)
  if (!lineupContainers.length) return undefined

  const home = getHomeCompetitor(competition)
  const away = getAwayCompetitor(competition)
  const homeLineup = findLineupForTeam(lineupContainers, home)
  const awayLineup = findLineupForTeam(lineupContainers, away)

  const lineups: RealMatchLineups = {
    confirmed: Boolean(homeLineup || awayLineup),
    homeFormation: homeLineup?.formation ?? null,
    awayFormation: awayLineup?.formation ?? null,
    homeCoach: homeLineup?.coach ?? null,
    awayCoach: awayLineup?.coach ?? null,
    homeXi: homeLineup?.starters ?? [],
    awayXi: awayLineup?.starters ?? [],
    homeSubs: homeLineup?.substitutes ?? [],
    awaySubs: awayLineup?.substitutes ?? []
  }

  if (!reverseTeamOrder) return lineups

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

function normalizeEspnCommentary(
  summary: EspnSummaryPayload | undefined,
  competition: EspnCompetition
): RealMatchCommentary[] {
  if (!summary) return []

  const sourceItems = [...(summary.commentary ?? []), ...(summary.plays ?? [])]
  const seen = new Set<string>()
  const commentary: RealMatchCommentary[] = []

  sourceItems.forEach((item) => {
    const text = item.text || item.shortText || item.displayValue || ''
    if (!text) return

    const player = item.athletesInvolved?.[0] ?? item.participants?.[0]?.athlete
    const team = getCompetitorByTeamId(competition, item.team?.id)
    const timeLabel = item.time?.displayValue || item.clock?.displayValue
    const elapsed = parseElapsedFromClock(timeLabel)
    const id = item.id ?? `${timeLabel ?? ''}-${text}`
    const key = String(id)

    if (seen.has(key)) return
    seen.add(key)

    commentary.push({
      id,
      elapsed,
      timeLabel,
      teamName: item.team?.displayName || team?.team?.displayName || team?.team?.name,
      playerName: player?.displayName || player?.fullName || player?.shortName,
      type: item.type,
      text
    })
  })

  return commentary
}

function getRecordSummary(competitor: EspnCompetitor | undefined) {
  return competitor?.records?.find((record) => record.type === 'total')?.summary || competitor?.records?.[0]?.summary
}

function normalizeBroadcasts(competition: EspnCompetition) {
  const names = [
    ...(competition.broadcasts ?? []).flatMap((broadcast) => broadcast.names ?? []),
    ...(competition.geoBroadcasts ?? []).map((broadcast) => broadcast.media?.shortName ?? '')
  ]
    .map((value) => value.trim())
    .filter(Boolean)

  return Array.from(new Set(names))
}

function normalizeLinks(event: EspnEvent, competition: EspnCompetition) {
  return [...(event.links ?? []), ...(competition.links ?? [])]
    .map((link) => ({
      text: link.shortText || link.text || 'Link',
      href: link.href || ''
    }))
    .filter((link) => link.href)
}

function normalizeEspnMatchData(
  event: EspnEvent,
  fixture: Fixture,
  fetchedAt: string,
  summary?: EspnSummaryPayload
): RealMatchData {
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
  const venueCity = [competition.venue?.address?.city, competition.venue?.address?.country]
    .filter(Boolean)
    .join(', ')

  return {
    provider: 'espn',
    apiFixtureId: event.id || competition.id || fixture.id,
    fetchedAt,
    status,
    homeTeam: {
      id: displayHome?.id ?? displayHome?.team?.id,
      name: displayHome?.team?.displayName || displayHome?.team?.name || getTeam(fixture.homeTeamId)?.name || 'Home',
      logo: displayHome?.team?.logo,
      color: displayHome?.team?.color,
      alternateColor: displayHome?.team?.alternateColor,
      record: getRecordSummary(displayHome),
      form: displayHome?.form
    },
    awayTeam: {
      id: displayAway?.id ?? displayAway?.team?.id,
      name: displayAway?.team?.displayName || displayAway?.team?.name || getTeam(fixture.awayTeamId)?.name || 'Away',
      logo: displayAway?.team?.logo,
      color: displayAway?.team?.color,
      alternateColor: displayAway?.team?.alternateColor,
      record: getRecordSummary(displayAway),
      form: displayAway?.form
    },
    score: {
      home: homeScore,
      away: awayScore,
      display: formatScore(homeScore, awayScore)
    },
    statistics: normalizeEspnStatistics(competition, reverseTeamOrder),
    events: normalizeEspnEvents(competition),
    commentary: normalizeEspnCommentary(summary, competition),
    lineups: normalizeEspnLineups(summary, competition, reverseTeamOrder),
    venue: competition.venue?.fullName || competition.venue?.displayName,
    venueCity,
    broadcasts: normalizeBroadcasts(competition),
    headline: competition.headlines?.[0]?.shortLinkText || competition.headlines?.[0]?.description,
    links: normalizeLinks(event, competition)
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

async function fetchEspnSummaryPayload(eventId: string | undefined): Promise<EspnSummaryPayload | undefined> {
  if (!eventId) return undefined

  const params = new URLSearchParams({ event: eventId })
  const response = await fetch(`${ESPN_PROXY_URL}?${params.toString()}`)

  if (!response.ok) return undefined

  const payload = (await response.json()) as EspnProxyResponse<EspnSummaryPayload, 'summary'>
  return payload.available ? payload.data : undefined
}

export async function fetchEspnWorldCupMatchDataForFixture(fixture: Fixture): Promise<RealMatchData> {
  if (!canFetchEspnWorldCupMatchData(fixture)) {
    throw new Error('ESPN World Cup data is not available for this fixture yet.')
  }

  if (!SUPABASE_URL) {
    throw new Error('ESPN World Cup proxy is not configured.')
  }

  const params = new URLSearchParams({ dates: getEspnDateParam(fixture) })
  const response = await fetch(`${ESPN_PROXY_URL}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`ESPN World Cup request failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as EspnProxyResponse<EspnScoreboardPayload, 'scoreboard'>

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

  const summary = await fetchEspnSummaryPayload(event.id).catch(() => undefined)

  return normalizeEspnMatchData(event, fixture, payload.fetchedAt, summary)
}
