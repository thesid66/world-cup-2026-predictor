import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Crosshair,
  Gauge,
  Medal,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { TeamFlag } from '../../components/ui/TeamFlag'
import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { calculateGroupTable } from '../../logic/groupTable'
import { calculateThirdPlaceRanking } from '../../logic/thirdPlaceRanking'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { RealMatchData, RealMatchEvent, RealMatchLineupPlayer, RealMatchStatistic } from '../../types/realMatch'
import type { Fixture, GroupCode, GroupTableRow, PredictionScore, Team, ThirdPlaceTableRow } from '../../types/tournament'

type StatKey = 'possession' | 'totalShots' | 'shotsOnGoal' | 'corners' | 'fouls' | 'yellowCards' | 'redCards'
type CountryStatusTone = 'qualified' | 'eliminated' | 'race' | 'active' | 'pending'

type CountryStatus = {
  label: string
  tone: CountryStatusTone
}

type ScoredPredictionScore = PredictionScore & {
  homeScore: number
  awayScore: number
}

type CountryMatchRow = {
  fixture: Fixture
  opponent?: Team
  isHome: boolean
  realMatch?: RealMatchData
  score?: PredictionScore
  countryScore: number | null
  opponentScore: number | null
  result: 'win' | 'draw' | 'loss' | 'pending'
  countryStats: RealMatchStatistic[]
  opponentStats: RealMatchStatistic[]
  countryEvents: RealMatchEvent[]
  lineupPlayers: RealMatchLineupPlayer[]
}

type PlayerImpactRow = {
  name: string
  goals: number
  yellowCards: number
  redCards: number
  starts: number
  captain: number
  ratingTotal: number
  ratingCount: number
}

type RatingCardProps = {
  label: string
  value: number
  caption: string
  icon: typeof Trophy
}

type SummaryCardProps = {
  label: string
  value: string | number
  detail: string
  icon: typeof Trophy
  tone?: 'yellow' | 'emerald' | 'sky' | 'rose'
}

type BenchmarkRowProps = {
  label: string
  countryValue: number | null
  groupValue: number | null
  suffix?: string
  lowerIsBetter?: boolean
}

const STAT_ALIASES: Record<StatKey, string[]> = {
  possession: ['ballpossession', 'possession', 'possessionpct', 'possessionpercentage'],
  totalShots: ['totalshots', 'shots', 'shot', 'attempts', 'totalattempts'],
  shotsOnGoal: ['shotsongoal', 'shotstarget', 'shotsontarget', 'sog', 'on target', 'ontarget'],
  corners: ['cornerkicks', 'corners', 'woncorners'],
  fouls: ['fouls', 'foulscommitted'],
  yellowCards: ['yellowcards', 'yellowcard', 'yellows'],
  redCards: ['redcards', 'redcard', 'reds']
}

function normalizeText(value: string | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeStatText(value: string | undefined) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseStatNumber(value: RealMatchStatistic['value']): number | null {
  const match = String(value ?? '')
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/)

  if (!match) return null

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function parseRating(value: RealMatchLineupPlayer['rating']): number | null {
  const parsed = parseStatNumber(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

function getStatValue(stats: RealMatchStatistic[], key: StatKey): number | null {
  const aliases = STAT_ALIASES[key]
  const stat = stats.find((item) => {
    const normalizedType = normalizeStatText(item.type)
    return aliases.some((alias) => normalizedType === alias || normalizedType.includes(alias) || alias.includes(normalizedType))
  })

  return stat ? parseStatNumber(stat.value) : null
}

function average(values: Array<number | null>): number | null {
  const cleanValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (!cleanValues.length) return null

  return cleanValues.reduce<number>((total, value) => total + value, 0) / cleanValues.length
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (typeof value === 'number' ? value : 0), 0)
}

function sumIfAvailable(values: Array<number | null>): number | null {
  const cleanValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (!cleanValues.length) return null

  return cleanValues.reduce<number>((total, value) => total + value, 0)
}

function formatNumber(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`
}

function formatPercent(value: number | null) {
  return formatNumber(value, '%')
}

function clampRating(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function weightedScore(value: number | null, maxValue: number, weight: number) {
  if (value === null || !Number.isFinite(value) || maxValue <= 0) return 0
  return Math.min(Math.max(value, 0) / maxValue, 1) * weight
}

function isScored(score?: PredictionScore): score is ScoredPredictionScore {
  return Boolean(score && typeof score.homeScore === 'number' && typeof score.awayScore === 'number')
}

function isGoalEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''} ${event.displayText ?? ''}`.toLowerCase().includes('goal')
}

function isYellowCardEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''} ${event.displayText ?? ''}`.toLowerCase().includes('yellow')
}

function isRedCardEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''} ${event.displayText ?? ''}`.toLowerCase().includes('red')
}

function getResult(countryScore: number | null, opponentScore: number | null): CountryMatchRow['result'] {
  if (countryScore === null || opponentScore === null) return 'pending'
  if (countryScore > opponentScore) return 'win'
  if (countryScore < opponentScore) return 'loss'
  return 'draw'
}

function getResultLabel(result: CountryMatchRow['result']) {
  if (result === 'win') return 'Win'
  if (result === 'loss') return 'Loss'
  if (result === 'draw') return 'Draw'
  return 'Pending'
}

function getResultClassName(result: CountryMatchRow['result']) {
  if (result === 'win') return 'bg-emerald-300 text-slate-950 ring-emerald-200/60'
  if (result === 'loss') return 'bg-rose-300 text-slate-950 ring-rose-200/60'
  if (result === 'draw') return 'bg-yellow-300 text-slate-950 ring-yellow-200/60'
  return 'bg-white/10 text-slate-300 ring-white/15'
}

function getCountryStatusClassName(tone: CountryStatusTone) {
  if (tone === 'qualified') return 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/25'
  if (tone === 'eliminated') return 'bg-rose-400/15 text-rose-200 ring-rose-300/25'
  if (tone === 'race') return 'bg-yellow-300/15 text-yellow-200 ring-yellow-300/25'
  if (tone === 'active') return 'bg-sky-300/15 text-sky-200 ring-sky-300/25'
  return 'bg-white/10 text-slate-300 ring-white/10'
}

function namesMatch(left: string | undefined, right: string | undefined) {
  const a = normalizeText(left)
  const b = normalizeText(right)

  if (!a || !b) return false

  return a === b || a.includes(b) || b.includes(a)
}

function getTeamStatsForMatch(match: RealMatchData | undefined, team: Team, isHome: boolean) {
  if (!match?.statistics.length) return []

  const expectedMatchTeam = isHome ? match.homeTeam : match.awayTeam
  const matchedStats = match.statistics.find(
    (item) => namesMatch(item.teamName, expectedMatchTeam.name) || namesMatch(item.teamName, team.name) || namesMatch(item.teamName, team.shortName)
  )

  return matchedStats?.statistics ?? match.statistics[isHome ? 0 : 1]?.statistics ?? []
}

function getOpponentStatsForMatch(match: RealMatchData | undefined, opponent: Team | undefined, isHome: boolean) {
  if (!match?.statistics.length) return []

  const expectedMatchTeam = isHome ? match.awayTeam : match.homeTeam
  const matchedStats = match.statistics.find(
    (item) => namesMatch(item.teamName, expectedMatchTeam.name) || namesMatch(item.teamName, opponent?.name) || namesMatch(item.teamName, opponent?.shortName)
  )

  return matchedStats?.statistics ?? match.statistics[isHome ? 1 : 0]?.statistics ?? []
}

function eventBelongsToCountry(event: RealMatchEvent, match: RealMatchData | undefined, team: Team, isHome: boolean) {
  if (!match || !event.teamName) return false

  const expectedMatchTeam = isHome ? match.homeTeam : match.awayTeam

  return namesMatch(event.teamName, expectedMatchTeam.name) || namesMatch(event.teamName, team.name) || namesMatch(event.teamName, team.shortName)
}

function getCountryLineupPlayers(match: RealMatchData | undefined, isHome: boolean): RealMatchLineupPlayer[] {
  const lineups = match?.lineups

  if (!lineups) return []

  return isHome ? lineups.homeXi : lineups.awayXi
}

function getCountryMatchRows(args: {
  team: Team
  teams: Team[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
  realMatches: Record<string, RealMatchData>
}): CountryMatchRow[] {
  const { team, teams, fixtures, scores, realMatches } = args

  return fixtures
    .filter((fixture) => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id)
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((fixture) => {
      const isHome = fixture.homeTeamId === team.id
      const opponent = teams.find((candidate) => candidate.id === (isHome ? fixture.awayTeamId : fixture.homeTeamId))
      const score = scores[fixture.id]
      const realMatch = realMatches[fixture.id]
      const countryScore = isScored(score) ? (isHome ? score.homeScore : score.awayScore) : null
      const opponentScore = isScored(score) ? (isHome ? score.awayScore : score.homeScore) : null
      const lineupPlayers = getCountryLineupPlayers(realMatch, isHome)

      return {
        fixture,
        opponent,
        isHome,
        realMatch,
        score,
        countryScore,
        opponentScore,
        result: getResult(countryScore, opponentScore),
        countryStats: getTeamStatsForMatch(realMatch, team, isHome),
        opponentStats: getOpponentStatsForMatch(realMatch, opponent, isHome),
        countryEvents: (realMatch?.events ?? []).filter(
          (event) => eventBelongsToCountry(event, realMatch, team, isHome) && (isGoalEvent(event) || isYellowCardEvent(event) || isRedCardEvent(event))
        ),
        lineupPlayers
      }
    })
}

function isGroupCompleteForCode(group: GroupCode, fixtures: Fixture[], scores: Record<string, PredictionScore>) {
  const groupFixtures = fixtures.filter((fixture) => fixture.stage === 'group' && fixture.group === group)
  return groupFixtures.length > 0 && groupFixtures.every((fixture) => isScored(scores[fixture.id]))
}

function getCountryStatus(args: {
  row?: GroupTableRow
  groupPosition: number
  groupComplete: boolean
  thirdPlaceStatus?: ThirdPlaceTableRow['qualificationStatus']
}): CountryStatus {
  const { row, groupPosition, groupComplete, thirdPlaceStatus } = args

  if (!row || groupPosition < 1) return { label: 'Pending', tone: 'pending' }

  if (row.directQualificationStatus === 'qualified' || (groupComplete && groupPosition <= 2)) {
    return { label: 'Qualified', tone: 'qualified' }
  }

  if (groupPosition === 3) {
    if (thirdPlaceStatus === 'qualified') return { label: 'Qualified', tone: 'qualified' }
    if (thirdPlaceStatus === 'eliminated') return { label: 'Eliminated', tone: 'eliminated' }
    return { label: groupComplete ? 'Waiting 3rd' : 'Best 3rd race', tone: 'race' }
  }

  if (groupComplete && groupPosition > 3) {
    return { label: 'Eliminated', tone: 'eliminated' }
  }

  return { label: row.played > 0 ? 'Active' : 'Upcoming', tone: row.played > 0 ? 'active' : 'pending' }
}

function buildPlayerImpact(rows: CountryMatchRow[], expectedGoals: number, expectedYellowCards: number, expectedRedCards: number) {
  const players = new Map<string, PlayerImpactRow>()

  function getPlayer(name: string) {
    const cleanedName = name.trim()

    if (!players.has(cleanedName)) {
      players.set(cleanedName, {
        name: cleanedName,
        goals: 0,
        yellowCards: 0,
        redCards: 0,
        starts: 0,
        captain: 0,
        ratingTotal: 0,
        ratingCount: 0
      })
    }

    return players.get(cleanedName)!
  }

  rows.forEach((row) => {
    row.countryEvents.forEach((event) => {
      if (!event.playerName) return

      const player = getPlayer(event.playerName)

      if (isGoalEvent(event)) player.goals += 1
      if (isYellowCardEvent(event)) player.yellowCards += 1
      if (isRedCardEvent(event)) player.redCards += 1
    })

    row.lineupPlayers.forEach((lineupPlayer) => {
      const player = getPlayer(lineupPlayer.name)
      const rating = parseRating(lineupPlayer.rating)

      player.starts += 1
      if (lineupPlayer.captain) player.captain += 1
      if (rating !== null) {
        player.ratingTotal += rating
        player.ratingCount += 1
      }
    })
  })

  const existingPlayers = Array.from(players.values())
  const assignedGoals = sum(existingPlayers.map((player) => player.goals))
  const assignedYellowCards = sum(existingPlayers.map((player) => player.yellowCards))
  const assignedRedCards = sum(existingPlayers.map((player) => player.redCards))

  if (expectedGoals > assignedGoals) getPlayer('Unassigned goals').goals = expectedGoals - assignedGoals
  if (expectedYellowCards > assignedYellowCards) getPlayer('Unassigned cards').yellowCards = expectedYellowCards - assignedYellowCards
  if (expectedRedCards > assignedRedCards) getPlayer('Unassigned red cards').redCards = expectedRedCards - assignedRedCards

  return Array.from(players.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals
    if (b.starts !== a.starts) return b.starts - a.starts
    if (b.yellowCards + b.redCards !== a.yellowCards + a.redCards) return b.yellowCards + b.redCards - (a.yellowCards + a.redCards)
    return a.name.localeCompare(b.name)
  })
}

function getAveragePlayerRating(players: PlayerImpactRow[]) {
  const ratedPlayers = players.filter((player) => player.ratingCount > 0)

  if (!ratedPlayers.length) return null

  const ratingTotal = ratedPlayers.reduce((total, player) => total + player.ratingTotal, 0)
  const ratingCount = ratedPlayers.reduce((total, player) => total + player.ratingCount, 0)

  return ratingCount ? ratingTotal / ratingCount : null
}

function RatingCard({ label, value, caption, icon: Icon }: RatingCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 shadow-xl shadow-black/10 ring-1 ring-white/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-yellow-300/15 text-yellow-200 ring-1 ring-yellow-300/20">
          <Icon className="size-5" />
        </span>
        <span className="text-3xl font-black text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-yellow-300" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-sm font-black text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{caption}</p>
    </article>
  )
}

function SummaryCard({ label, value, detail, icon: Icon, tone = 'yellow' }: SummaryCardProps) {
  const toneClassNames = {
    yellow: 'bg-yellow-300/15 text-yellow-200 ring-yellow-300/25',
    emerald: 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/25',
    sky: 'bg-sky-300/15 text-sky-200 ring-sky-300/25',
    rose: 'bg-rose-300/15 text-rose-200 ring-rose-300/25'
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`inline-flex size-11 items-center justify-center rounded-2xl ring-1 ${toneClassNames[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">{detail}</p>
    </article>
  )
}

function BenchmarkRow({ label, countryValue, groupValue, suffix = '', lowerIsBetter = false }: BenchmarkRowProps) {
  const delta = countryValue === null || groupValue === null ? null : countryValue - groupValue
  const isPositive = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0)
  const deltaLabel = delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${suffix}`

  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{formatNumber(countryValue, suffix)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${isPositive ? 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/25' : 'bg-white/10 text-slate-300 ring-white/10'}`}>
          {deltaLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
        <span>Group avg</span>
        <span>{formatNumber(groupValue, suffix)}</span>
      </div>
    </div>
  )
}

export function CountryPage() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const loading = useRealMatchStore((state) => state.loading)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const { teams, groups, fixtures } = useTournamentData()
  const [selectedTeamId, setSelectedTeamId] = useState('australia')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const selectedTeam = teams.find((candidate) => candidate.id === selectedTeamId) ?? teams[0]

  const filteredTeams = useMemo(() => {
    const searchTerm = countrySearch.trim().toLowerCase()

    if (!searchTerm) return teams

    return teams.filter((candidate) => {
      const searchableText = `${candidate.name} ${candidate.shortName} ${candidate.group} ${candidate.confederation}`.toLowerCase()
      return searchableText.includes(searchTerm)
    })
  }, [countrySearch, teams])

  const countryFixtures = useMemo(
    () => selectedTeam ? fixtures.filter((fixture) => fixture.homeTeamId === selectedTeam.id || fixture.awayTeamId === selectedTeam.id) : [],
    [fixtures, selectedTeam]
  )

  useEffect(() => {
    countryFixtures.forEach((fixture) => {
      if (realMatches[fixture.id] || loading[fixture.id]) return

      void fetchMatchData(fixture, false, { silent: true })
    })
  }, [countryFixtures, fetchMatchData, loading, realMatches])

  if (!selectedTeam) {
    return null
  }

  const team = selectedTeam
  const group = groups.find((candidate) => candidate.code === team.group)
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)
  const groupTables = new Map(
    groups.map((currentGroup) => [
      currentGroup.code,
      calculateGroupTable({ group: currentGroup.code, teams, fixtures, scores })
    ] as const)
  )
  const groupCompleteByCode = new Map(
    groups.map((currentGroup) => [currentGroup.code, isGroupCompleteForCode(currentGroup.code, fixtures, scores)] as const)
  )
  const thirdPlaceRanking = calculateThirdPlaceRanking(scores, { groups, teams, fixtures })
  const getStatusForTeam = (candidate: Team): CountryStatus => {
    const candidateGroupTable = groupTables.get(candidate.group) ?? []
    const candidatePosition = candidateGroupTable.findIndex((row) => row.teamId === candidate.id) + 1
    const candidateRow = candidateGroupTable.find((row) => row.teamId === candidate.id)
    const thirdPlaceStatus = thirdPlaceRanking.find((row) => row.teamId === candidate.id)?.qualificationStatus

    return getCountryStatus({
      row: candidateRow,
      groupPosition: candidatePosition,
      groupComplete: groupCompleteByCode.get(candidate.group) ?? false,
      thirdPlaceStatus
    })
  }
  const groupTable = groupTables.get(team.group) ?? []
  const groupPosition = groupTable.findIndex((row) => row.teamId === team.id) + 1
  const tableRow = groupTable.find((row) => row.teamId === team.id)
  const countryStatus = getStatusForTeam(team)
  const rows = getCountryMatchRows({ team, teams, fixtures, scores, realMatches })
  const completedRows = rows.filter((row) => row.countryScore !== null && row.opponentScore !== null)
  const statRows = rows.filter((row) => row.countryStats.length)
  const allCountryEvents = rows.flatMap((row) => row.countryEvents)
  const possessionAverage = average(statRows.map((row) => getStatValue(row.countryStats, 'possession')))
  const shotsAverage = average(statRows.map((row) => getStatValue(row.countryStats, 'totalShots')))
  const shotsOnGoalAverage = average(statRows.map((row) => getStatValue(row.countryStats, 'shotsOnGoal')))
  const cornersAverage = average(statRows.map((row) => getStatValue(row.countryStats, 'corners')))
  const foulsAverage = average(statRows.map((row) => getStatValue(row.countryStats, 'fouls')))
  const opponentShotsOnGoalAverage = average(statRows.map((row) => getStatValue(row.opponentStats, 'shotsOnGoal')))
  const yellowCardsFromStats = sumIfAvailable(statRows.map((row) => getStatValue(row.countryStats, 'yellowCards')))
  const redCardsFromStats = sumIfAvailable(statRows.map((row) => getStatValue(row.countryStats, 'redCards')))
  const yellowCardsFromEvents = allCountryEvents.filter(isYellowCardEvent).length
  const redCardsFromEvents = allCountryEvents.filter(isRedCardEvent).length
  const yellowCards = yellowCardsFromStats ?? yellowCardsFromEvents
  const redCards = redCardsFromStats ?? redCardsFromEvents
  const cardsPerMatch = completedRows.length ? (yellowCards + redCards) / completedRows.length : null
  const goalsPerMatch = tableRow?.played ? tableRow.goalsFor / tableRow.played : 0
  const goalsAgainstPerMatch = tableRow?.played ? tableRow.goalsAgainst / tableRow.played : 0
  const cleanSheets = completedRows.filter((row) => row.opponentScore === 0).length
  const failedToScore = completedRows.filter((row) => row.countryScore === 0).length
  const wins = completedRows.filter((row) => row.result === 'win').length
  const winRate = completedRows.length ? (wins / completedRows.length) * 100 : null
  const cleanSheetRate = completedRows.length ? cleanSheets / completedRows.length : 0
  const shotAccuracy = shotsAverage && shotsOnGoalAverage ? (shotsOnGoalAverage / shotsAverage) * 100 : null
  const conversionRate = shotsAverage && tableRow?.played ? (tableRow.goalsFor / (shotsAverage * tableRow.played)) * 100 : null
  const playerImpact = buildPlayerImpact(rows, tableRow?.goalsFor ?? 0, yellowCards, redCards)
  const averagePlayerRating = getAveragePlayerRating(playerImpact)
  const attackRating = clampRating(
    weightedScore(goalsPerMatch, 3, 35) + weightedScore(shotsOnGoalAverage, 7, 25) + weightedScore(shotsAverage, 20, 20) + weightedScore(conversionRate, 30, 20)
  )
  const defenceRating = clampRating(
    100 - goalsAgainstPerMatch * 26 - (opponentShotsOnGoalAverage ?? 0) * 7 + cleanSheetRate * 18
  )
  const controlRating = statRows.length
    ? clampRating(weightedScore(possessionAverage, 70, 50) + weightedScore(shotsAverage, 20, 25) + weightedScore(cornersAverage, 8, 25) - (foulsAverage ?? 0) * 0.8)
    : 0
  const disciplineRating = completedRows.length
    ? clampRating(100 - (cardsPerMatch ?? 0) * 22 - (foulsAverage ?? 0) * 1.5)
    : 0
  const espnLoadedCount = rows.filter((row) => row.realMatch).length

  const groupSnapshots = teams
    .filter((candidate) => candidate.group === team.group)
    .map((groupTeam) => {
      const groupTeamRows = getCountryMatchRows({ team: groupTeam, teams, fixtures, scores, realMatches })
      const groupTeamCompletedRows = groupTeamRows.filter((row) => row.countryScore !== null && row.opponentScore !== null)
      const groupTeamStatRows = groupTeamRows.filter((row) => row.countryStats.length)
      const groupTeamEvents = groupTeamRows.flatMap((row) => row.countryEvents)
      const groupTeamTableRow = groupTable.find((row) => row.teamId === groupTeam.id)
      const groupTeamYellowCards = sumIfAvailable(groupTeamStatRows.map((row) => getStatValue(row.countryStats, 'yellowCards'))) ?? groupTeamEvents.filter(isYellowCardEvent).length
      const groupTeamRedCards = sumIfAvailable(groupTeamStatRows.map((row) => getStatValue(row.countryStats, 'redCards'))) ?? groupTeamEvents.filter(isRedCardEvent).length

      return {
        goalsPerMatch: groupTeamTableRow?.played ? groupTeamTableRow.goalsFor / groupTeamTableRow.played : null,
        shotsAverage: average(groupTeamStatRows.map((row) => getStatValue(row.countryStats, 'totalShots'))),
        possessionAverage: average(groupTeamStatRows.map((row) => getStatValue(row.countryStats, 'possession'))),
        cardsPerMatch: groupTeamCompletedRows.length ? (groupTeamYellowCards + groupTeamRedCards) / groupTeamCompletedRows.length : null
      }
    })
  const groupBenchmark = {
    goalsPerMatch: average(groupSnapshots.map((snapshot) => snapshot.goalsPerMatch)),
    shotsAverage: average(groupSnapshots.map((snapshot) => snapshot.shotsAverage)),
    possessionAverage: average(groupSnapshots.map((snapshot) => snapshot.possessionAverage)),
    cardsPerMatch: average(groupSnapshots.map((snapshot) => snapshot.cardsPerMatch))
  }

  return (
    <div className="grid min-w-0 gap-5 overflow-hidden sm:gap-6">
      <section className="relative min-w-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2rem] sm:p-6 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
        <div className="relative grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-yellow-950/20">
                <Sparkles className="size-4" />
                Country intelligence demo
              </span>
            </div>

            <div className="mt-8 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
              <div className="flex size-28 shrink-0 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl ring-1 ring-white/10 sm:size-36">
                <TeamFlag code={team.flagCode} label={team.name} size="lg" className="scale-[2.6] sm:scale-[3.25]" />
              </div>
              <div className="min-w-0 max-w-full overflow-hidden">
                <p className="truncate text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
                  {group?.name ?? `Group ${team.group}`} · {team.confederation}
                </p>
                <h1 className="mt-2 max-w-full break-words text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl xl:text-7xl">
                  {team.name}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10">
                    #{groupPosition || '—'} in Group {team.group}
                  </span>
                  <span className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${getCountryStatusClassName(countryStatus.tone)}`}>
                    {countryStatus.label}
                  </span>
                  <span className="rounded-full bg-sky-300/15 px-4 py-2 text-sm font-black text-sky-200 ring-1 ring-sky-300/25">
                    ESPN loaded {espnLoadedCount}/{rows.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Live profile</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950/45 p-4 text-center ring-1 ring-white/10">
                <p className="text-4xl font-black text-white">{tableRow?.points ?? 0}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Points</p>
              </div>
              <div className="rounded-2xl bg-slate-950/45 p-4 text-center ring-1 ring-white/10">
                <p className="text-4xl font-black text-white">{tableRow?.goalDifference ?? 0}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">GD</p>
              </div>
              <div className="rounded-2xl bg-slate-950/45 p-4 text-center ring-1 ring-white/10">
                <p className="text-4xl font-black text-white">{formatNumber(goalsPerMatch)}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Goals / match</p>
              </div>
              <div className="rounded-2xl bg-slate-950/45 p-4 text-center ring-1 ring-white/10">
                <p className="text-4xl font-black text-white">{cleanSheets}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Clean sheets</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">Country selector</p>
            <h2 className="mt-1 text-2xl font-black text-white">Preview any team profile</h2>
            <p className="mt-2 text-sm font-bold text-slate-400">Search and switch teams without creating horizontal page overflow.</p>
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={selectorOpen}
              onClick={() => setSelectorOpen((value) => !value)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left shadow-xl ring-1 ring-white/5 transition hover:border-yellow-300/40 hover:bg-slate-950/80"
            >
              <span className="flex min-w-0 items-center gap-3">
                <TeamFlag code={team.flagCode} label={team.name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white">{team.name}</span>
                  <span className="block truncate text-xs font-bold text-slate-400">Group {team.group} · {team.confederation}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`hidden rounded-full px-3 py-1 text-xs font-black ring-1 sm:inline-flex ${getCountryStatusClassName(countryStatus.tone)}`}>
                  {countryStatus.label}
                </span>
                <ChevronDown className={`size-5 text-yellow-300 transition ${selectorOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {selectorOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl ring-1 ring-white/10">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                    placeholder="Search country, group or confederation"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/8 pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300/50 focus:ring-2 focus:ring-yellow-300/20"
                    autoFocus
                  />
                </label>

                <div className="mt-3 max-h-80 overflow-y-auto pr-1">
                  {filteredTeams.map((candidate) => {
                    const isActive = candidate.id === team.id
                    const candidateStatus = getStatusForTeam(candidate)

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeamId(candidate.id)
                          setCountrySearch('')
                          setSelectorOpen(false)
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          isActive ? 'bg-yellow-300 text-slate-950' : 'text-slate-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <TeamFlag code={candidate.flagCode} label={candidate.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black">{candidate.name}</span>
                            <span className={`block truncate text-xs font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                              {candidate.shortName} · Group {candidate.group} · {candidate.confederation}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ring-1 ${getCountryStatusClassName(candidateStatus.tone)}`}>
                            {candidateStatus.label}
                          </span>
                          {isActive && <Check className="size-4 shrink-0" />}
                        </span>
                      </button>
                    )
                  })}

                  {filteredTeams.length === 0 && (
                    <p className="rounded-2xl bg-white/8 px-3 py-4 text-sm font-bold text-slate-400">No country found.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-6">
        <SummaryCard label="Record" value={`${tableRow?.won ?? 0}-${tableRow?.drawn ?? 0}-${tableRow?.lost ?? 0}`} detail="Wins, draws and losses from scored fixtures." icon={Trophy} />
        <SummaryCard label="Goals" value={`${tableRow?.goalsFor ?? 0}:${tableRow?.goalsAgainst ?? 0}`} detail="Goals for and against." icon={Crosshair} tone="emerald" />
        <SummaryCard label="Shots" value={formatNumber(shotsAverage)} detail="Average total shots when ESPN stats are loaded." icon={Zap} tone="sky" />
        <SummaryCard label="Accuracy" value={formatPercent(shotAccuracy)} detail="Shots on goal divided by total shots." icon={Gauge} />
        <SummaryCard label="Cards" value={yellowCards + redCards} detail={`${yellowCards} yellow · ${redCards} red`} icon={Shield} tone="rose" />
        <SummaryCard label="Avg rating" value={formatNumber(averagePlayerRating)} detail="Player rating, only if ESPN provides lineup ratings." icon={Medal} tone="yellow" />
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Performance engine</p>
              <h2 className="mt-2 text-3xl font-black text-white">Generated ratings</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">Rebalanced</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RatingCard label="Attack rating" value={attackRating} caption="Goals, shots, shots on goal and conversion. Scaled, not capped by raw shot volume." icon={TrendingUp} />
            <RatingCard label="Control rating" value={controlRating} caption="Possession, shots, corners and fouls balance." icon={BarChart3} />
            <RatingCard label="Defence rating" value={defenceRating} caption="Goals conceded, clean sheets and opponent pressure." icon={Shield} />
            <RatingCard label="Discipline rating" value={disciplineRating} caption="Cards and fouls. Uses event cards when ESPN team-card stats are missing." icon={BadgeCheck} />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Match DNA</p>
              <h2 className="mt-2 text-3xl font-black text-white">Average stat profile</h2>
            </div>
            <p className="max-w-sm text-xs font-bold leading-5 text-slate-400">xG is not estimated. It will only show if ESPN provides it directly.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Possession', formatPercent(possessionAverage), 'Average ball control'],
              ['Shots', formatNumber(shotsAverage), 'Total shots per match'],
              ['Shots on goal', formatNumber(shotsOnGoalAverage), 'On-target attempts per match'],
              ['Corners', formatNumber(cornersAverage), 'Set-piece pressure'],
              ['Fouls', formatNumber(foulsAverage), 'Discipline pressure'],
              ['Conversion', formatPercent(conversionRate), 'Goals divided by total shots']
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black text-white">{value}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">Match command centre</p>
            <h2 className="mt-2 text-3xl font-black text-white">Match-by-match stats</h2>
          </div>
          <span className="rounded-full bg-sky-300/10 px-3 py-1 text-xs font-black text-sky-200 ring-1 ring-sky-300/20">{rows.length} fixtures</span>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          {rows.map((row) => {
            const possession = getStatValue(row.countryStats, 'possession')
            const shots = getStatValue(row.countryStats, 'totalShots')
            const shotsOnGoal = getStatValue(row.countryStats, 'shotsOnGoal')
            const corners = getStatValue(row.countryStats, 'corners')
            const statusLabel = row.realMatch?.status.short ?? (isScored(row.score) ? 'FT' : 'NS')

            return (
              <article key={row.fixture.id} className="group min-w-0 rounded-3xl border border-white/10 bg-slate-950/40 p-4 transition hover:-translate-y-1 hover:border-yellow-300/35 hover:bg-slate-950/60">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">Match {row.fixture.matchNumber}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${getResultClassName(row.result)}`}>{getResultLabel(row.result)} · {statusLabel}</span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{row.isHome ? 'Home' : 'Away'} vs</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <TeamFlag code={row.opponent?.flagCode} label={row.opponent?.name} size="md" />
                      <p className="truncate text-lg font-black text-white">{row.opponent?.name ?? 'TBD'}</p>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/10">
                    <p className="text-2xl font-black text-white">{row.countryScore ?? '-'}:{row.opponentScore ?? '-'}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Score</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-white/8 p-3"><p className="text-lg font-black text-white">{formatPercent(possession)}</p><p className="text-[10px] font-black uppercase text-slate-500">Possession</p></div>
                  <div className="rounded-2xl bg-white/8 p-3"><p className="text-lg font-black text-white">{formatNumber(shots)}</p><p className="text-[10px] font-black uppercase text-slate-500">Shots</p></div>
                  <div className="rounded-2xl bg-white/8 p-3"><p className="text-lg font-black text-white">{formatNumber(shotsOnGoal)}</p><p className="text-[10px] font-black uppercase text-slate-500">On target</p></div>
                  <div className="rounded-2xl bg-white/8 p-3"><p className="text-lg font-black text-white">{formatNumber(corners)}</p><p className="text-[10px] font-black uppercase text-slate-500">Corners</p></div>
                </div>
                <div className="mt-4 flex min-w-0 items-center gap-2 text-xs font-bold text-slate-400">
                  <CalendarDays className="size-4 shrink-0 text-yellow-300" />
                  <span>{row.fixture.date}</span>
                  <span>·</span>
                  <span className="truncate">{row.realMatch?.venue ?? row.fixture.venue}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Player impact</p>
              <h2 className="mt-2 text-3xl font-black text-white">Goals, cards, starts and ratings</h2>
            </div>
            <Medal className="size-8 text-yellow-300" />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-slate-950/70 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                <tr><th className="px-4 py-3">Player</th><th className="px-4 py-3 text-center">G</th><th className="px-4 py-3 text-center">YC</th><th className="px-4 py-3 text-center">RC</th><th className="px-4 py-3 text-center">Starts</th><th className="px-4 py-3 text-center">Rating</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {playerImpact.slice(0, 9).map((player) => {
                  const averageRating = player.ratingCount ? player.ratingTotal / player.ratingCount : null

                  return (
                    <tr key={player.name} className="bg-white/5 text-slate-200">
                      <td className="px-4 py-3 font-black text-white">{player.name}{player.captain > 0 && <span className="ml-2 rounded-full bg-yellow-300/15 px-2 py-0.5 text-[10px] text-yellow-200">C</span>}</td>
                      <td className="px-4 py-3 text-center font-black">{player.goals}</td>
                      <td className="px-4 py-3 text-center font-black">{player.yellowCards}</td>
                      <td className="px-4 py-3 text-center font-black">{player.redCards}</td>
                      <td className="px-4 py-3 text-center font-black">{player.starts}</td>
                      <td className="px-4 py-3 text-center font-black">{formatNumber(averageRating)}</td>
                    </tr>
                  )
                })}
                {playerImpact.length === 0 && <tr><td className="px-4 py-5 text-sm font-bold text-slate-400" colSpan={6}>ESPN player events or lineups are not loaded for this country yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Recommended insight</p>
              <h2 className="mt-2 text-3xl font-black text-white">Group benchmark</h2>
            </div>
            <BarChart3 className="size-8 text-emerald-300" />
          </div>

          <div className="grid gap-3">
            <BenchmarkRow label="Goals / match" countryValue={goalsPerMatch} groupValue={groupBenchmark.goalsPerMatch} />
            <BenchmarkRow label="Shots / match" countryValue={shotsAverage} groupValue={groupBenchmark.shotsAverage} />
            <BenchmarkRow label="Possession" countryValue={possessionAverage} groupValue={groupBenchmark.possessionAverage} suffix="%" />
            <BenchmarkRow label="Cards / match" countryValue={cardsPerMatch} groupValue={groupBenchmark.cardsPerMatch} lowerIsBetter />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
              <p className="text-2xl font-black text-white">{formatPercent(winRate)}</p>
              <p className="text-[10px] font-black uppercase text-slate-500">Win rate</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
              <p className="text-2xl font-black text-white">{cleanSheets}</p>
              <p className="text-[10px] font-black uppercase text-slate-500">Clean sheets</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
              <p className="text-2xl font-black text-white">{failedToScore}</p>
              <p className="text-[10px] font-black uppercase text-slate-500">Blanked</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
