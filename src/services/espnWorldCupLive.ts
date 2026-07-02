import { teams } from '../data/teams'
import type { RealMatchData, RealMatchShootout, RealMatchSide } from '../types/realMatch'
import type { Fixture, Team } from '../types/tournament'
import {
  canFetchEspnWorldCupMatchData as canFetchBaseEspnWorldCupMatchData,
  fetchEspnWorldCupMatchDataForFixture as fetchBaseEspnWorldCupMatchDataForFixture
} from './espnWorldCup'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const ESPN_PROXY_URL = `${SUPABASE_URL}/functions/v1/espn-worldcup-scoreboard`
const REQUIRED_LEAGUE_SLUG = 'fifa.world'
const REQUIRED_SEASON_YEAR = 2026
const TOURNAMENT_UTC_OFFSET_MS = 4 * 60 * 60 * 1000
const KNOCKOUT_FIRST_MATCH_NUMBER = 73

type JsonRecord = Record<string, unknown>

type EspnProxyResponse<TData> =
  | {
      available: true
      source: 'espn'
      fetchedAt: string
      data: TData
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
  date?: string
  season?: {
    year?: number | string
  }
  competitions?: EspnCompetition[]
}

type EspnCompetition = {
  id?: string
  date?: string
  startDate?: string
  altGameNote?: string
  status?: {
    type?: {
      completed?: boolean
      state?: string
    }
  }
  competitors?: EspnCompetitor[]
}

type EspnCompetitor = JsonRecord & {
  id?: string
  homeAway?: 'home' | 'away' | string
  score?: string
  winner?: boolean
  team?: {
    id?: string
    abbreviation?: string
    displayName?: string
    shortDisplayName?: string
    name?: string
    location?: string
  }
}

type EspnResultEnhancement = {
  winnerTeamId?: string
  winningSide: RealMatchSide | null
  penaltyShootout?: RealMatchShootout
  scoreDisplay?: string
}

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

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const match = String(value ?? '')
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/)

  if (!match) return null

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function readNumberFromKeys(value: unknown, keys: string[]) {
  if (!isRecord(value)) return null

  for (const key of keys) {
    const parsed = parseNumber(value[key])

    if (parsed !== null) {
      return parsed
    }
  }

  return null
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
  if (event.season?.year && Number(event.season.year) !== REQUIRED_SEASON_YEAR) return false

  const competition = getPrimaryCompetition(event)

  if (!competition?.altGameNote?.includes('FIFA World Cup')) return false
  if (getEventTournamentDate(event, competition) !== fixture.date) return false

  const fixtureHomeTokens = getComparableTeamTokens(teamById.get(fixture.homeTeamId))
  const fixtureAwayTokens = getComparableTeamTokens(teamById.get(fixture.awayTeamId))
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

  const fixtureHomeTokens = getComparableTeamTokens(teamById.get(fixture.homeTeamId))
  const eventAwayTokens = getComparableCompetitorTokens(getAwayCompetitor(competition))

  return tokensOverlap(fixtureHomeTokens, eventAwayTokens)
}

function isValidWorldCupPayload(payload: EspnScoreboardPayload) {
  return payload.leagues?.some((league) => {
    const seasonYear = Number(league.season?.year)
    return league.slug === REQUIRED_LEAGUE_SLUG && seasonYear === REQUIRED_SEASON_YEAR
  })
}

function isCompetitionComplete(competition: EspnCompetition) {
  const state = competition.status?.type?.state
  return state === 'post' || Boolean(competition.status?.type?.completed)
}

function formatScore(home: number | null, away: number | null) {
  if (home === null || away === null) return '-'
  return `${home} - ${away}`
}

function getCompetitorWinner(competitor: EspnCompetitor | undefined) {
  if (!competitor) return false
  if (competitor.winner === true) return true
  if (readBoolean(competitor, 'winner')) return true

  const resultText = [
    readString(competitor, 'result'),
    readString(competitor, 'outcome'),
    readString(competitor, 'status')
  ]
    .join(' ')
    .toLowerCase()

  return resultText.includes('win') || resultText.includes('winner')
}

function getPenaltyScoreFromContainer(value: unknown) {
  const directValue = parseNumber(value)

  if (directValue !== null) {
    return directValue
  }

  return readNumberFromKeys(value, [
    'score',
    'value',
    'displayValue',
    'goals',
    'made',
    'converted',
    'total'
  ])
}

function getCompetitorPenaltyScore(competitor: EspnCompetitor | undefined) {
  if (!competitor) return null

  const directScore = readNumberFromKeys(competitor, [
    'shootoutScore',
    'shootout_score',
    'penaltyScore',
    'penalty_score',
    'penalties',
    'penaltyShootoutScore',
    'shootoutGoals'
  ])

  if (directScore !== null) return directScore

  const nestedKeys = ['shootout', 'penaltyShootout', 'penaltyKicks', 'penalty_kicks']

  for (const key of nestedKeys) {
    const nestedScore = getPenaltyScoreFromContainer(readRecord(competitor, key) ?? competitor[key])

    if (nestedScore !== null) {
      return nestedScore
    }
  }

  const linescorePenalty = readArray(competitor, 'linescores')
    .map((line) => {
      const label = [
        readString(line, 'period'),
        readString(line, 'type'),
        readString(line, 'name'),
        readString(line, 'displayName'),
        readString(line, 'label')
      ]
        .join(' ')
        .toLowerCase()

      if (!label.includes('pen') && !label.includes('shoot')) return null

      return getPenaltyScoreFromContainer(line)
    })
    .find((value): value is number => value !== null)

  return linescorePenalty ?? null
}

function getShootout(displayHome: EspnCompetitor | undefined, displayAway: EspnCompetitor | undefined): RealMatchShootout | undefined {
  const home = getCompetitorPenaltyScore(displayHome)
  const away = getCompetitorPenaltyScore(displayAway)

  if (home === null && away === null) return undefined

  return {
    home,
    away,
    display: home !== null && away !== null ? `${home} - ${away}` : null
  }
}

function getWinningSide(args: {
  displayHome: EspnCompetitor | undefined
  displayAway: EspnCompetitor | undefined
  penaltyShootout?: RealMatchShootout
  homeScore: number | null
  awayScore: number | null
  completed: boolean
}): RealMatchSide | null {
  const { displayHome, displayAway, penaltyShootout, homeScore, awayScore, completed } = args
  const homeWinner = getCompetitorWinner(displayHome)
  const awayWinner = getCompetitorWinner(displayAway)

  if (homeWinner && !awayWinner) return 'home'
  if (awayWinner && !homeWinner) return 'away'

  if (
    penaltyShootout?.home !== null &&
    penaltyShootout?.away !== null &&
    typeof penaltyShootout?.home === 'number' &&
    typeof penaltyShootout?.away === 'number' &&
    penaltyShootout.home !== penaltyShootout.away
  ) {
    return penaltyShootout.home > penaltyShootout.away ? 'home' : 'away'
  }

  if (completed && homeScore !== null && awayScore !== null && homeScore !== awayScore) {
    return homeScore > awayScore ? 'home' : 'away'
  }

  return null
}

async function fetchScoreboardPayload(fixture: Fixture) {
  if (!SUPABASE_URL) return null

  const params = new URLSearchParams({ dates: fixture.date.replace(/[^0-9]/g, '') })
  const response = await fetch(`${ESPN_PROXY_URL}?${params.toString()}`)

  if (!response.ok) return null

  const payload = (await response.json()) as EspnProxyResponse<EspnScoreboardPayload>

  if (!payload.available || !isValidWorldCupPayload(payload.data)) {
    return null
  }

  return payload.data
}

async function fetchEspnResultEnhancement(fixture: Fixture): Promise<EspnResultEnhancement | null> {
  const scoreboard = await fetchScoreboardPayload(fixture)
  const event = scoreboard?.events?.find((candidate) => eventMatchesFixture(candidate, fixture))
  const competition = event ? getPrimaryCompetition(event) : undefined

  if (!event || !competition) return null

  const reverseTeamOrder = shouldReverseTeamOrder(event, fixture)
  const home = getHomeCompetitor(competition)
  const away = getAwayCompetitor(competition)
  const displayHome = reverseTeamOrder ? away : home
  const displayAway = reverseTeamOrder ? home : away
  const completed = isCompetitionComplete(competition)
  const homeScore = parseNumber(displayHome?.score)
  const awayScore = parseNumber(displayAway?.score)
  const penaltyShootout = getShootout(displayHome, displayAway)
  const winningSide = getWinningSide({
    displayHome,
    displayAway,
    penaltyShootout,
    homeScore,
    awayScore,
    completed
  })
  const baseScoreDisplay = formatScore(homeScore, awayScore)
  const scoreDisplay = penaltyShootout?.display
    ? `${baseScoreDisplay} (${penaltyShootout.display} pens)`
    : baseScoreDisplay

  return {
    winningSide,
    winnerTeamId: winningSide === 'home' ? fixture.homeTeamId : winningSide === 'away' ? fixture.awayTeamId : undefined,
    penaltyShootout,
    scoreDisplay
  }
}

function shouldEnhanceResult(fixture: Fixture, matchData: RealMatchData) {
  if (fixture.matchNumber >= KNOCKOUT_FIRST_MATCH_NUMBER) return true
  return matchData.score.home === matchData.score.away
}

export function canFetchEspnWorldCupMatchData(fixture: Fixture) {
  return Boolean(fixture.homeTeamId && fixture.awayTeamId && fixture.date)
}

export async function fetchEspnWorldCupMatchDataForFixture(fixture: Fixture): Promise<RealMatchData> {
  if (!canFetchEspnWorldCupMatchData(fixture)) {
    throw new Error('ESPN World Cup data is not available for this fixture yet.')
  }

  const lookupFixture: Fixture = canFetchBaseEspnWorldCupMatchData(fixture)
    ? fixture
    : {
        ...fixture,
        stage: 'group'
      }

  const matchData = await fetchBaseEspnWorldCupMatchDataForFixture(lookupFixture)

  if (!shouldEnhanceResult(fixture, matchData)) {
    return matchData
  }

  const enhancement = await fetchEspnResultEnhancement(fixture).catch(() => null)

  if (!enhancement) {
    return matchData
  }

  return {
    ...matchData,
    score: {
      ...matchData.score,
      display: enhancement.scoreDisplay ?? matchData.score.display,
      penaltyShootout: enhancement.penaltyShootout,
      afterPenalties: Boolean(enhancement.penaltyShootout)
    },
    penaltyShootout: enhancement.penaltyShootout,
    winningSide: enhancement.winningSide,
    winnerTeamId: enhancement.winnerTeamId
  }
}
