import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Crosshair,
  Gauge,
  Medal,
  Shield,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { TeamFlag } from '../../components/ui/TeamFlag'
import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { calculateGroupTable } from '../../logic/groupTable'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { RealMatchData, RealMatchEvent, RealMatchLineupPlayer, RealMatchStatistic } from '../../types/realMatch'
import type { Fixture, GroupTableRow, PredictionScore, Team } from '../../types/tournament'

const STAT_TYPES = {
  possession: 'Ball Possession',
  totalShots: 'Total Shots',
  shotsOnGoal: 'Shots on Goal',
  corners: 'Corner Kicks',
  fouls: 'Fouls',
  yellowCards: 'Yellow Cards',
  redCards: 'Red Cards'
} as const

type StatType = (typeof STAT_TYPES)[keyof typeof STAT_TYPES]

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
}

type PlayerImpactRow = {
  name: string
  goals: number
  yellowCards: number
  redCards: number
  starts: number
  captain: number
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

function normalizeText(value: string | undefined) {
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

function getStatValue(stats: RealMatchStatistic[], type: StatType): number | null {
  const stat = stats.find((item) => item.type === type)
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

function isScored(score?: PredictionScore): score is ScoredPredictionScore {
  return Boolean(score && typeof score.homeScore === 'number' && typeof score.awayScore === 'number')
}

function isGoalEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''}`.toLowerCase().includes('goal')
}

function isYellowCardEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''}`.toLowerCase().includes('yellow')
}

function isRedCardEvent(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''}`.toLowerCase().includes('red')
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

function getTeamStatsForMatch(match: RealMatchData | undefined, isHome: boolean) {
  if (!match?.statistics.length) return []
  return match.statistics[isHome ? 0 : 1]?.statistics ?? []
}

function getOpponentStatsForMatch(match: RealMatchData | undefined, isHome: boolean) {
  if (!match?.statistics.length) return []
  return match.statistics[isHome ? 1 : 0]?.statistics ?? []
}

function eventBelongsToCountry(event: RealMatchEvent, match: RealMatchData | undefined, isHome: boolean) {
  if (!match || !event.teamName) return false

  const countryName = isHome ? match.homeTeam.name : match.awayTeam.name
  const eventTeam = normalizeText(event.teamName)
  const teamName = normalizeText(countryName)

  return eventTeam.includes(teamName) || teamName.includes(eventTeam)
}

function getCountryLineupPlayers(row: CountryMatchRow): RealMatchLineupPlayer[] {
  const lineups = row.realMatch?.lineups

  if (!lineups) return []

  return row.isHome ? lineups.homeXi : lineups.awayXi
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

      return {
        fixture,
        opponent,
        isHome,
        realMatch,
        score,
        countryScore,
        opponentScore,
        result: getResult(countryScore, opponentScore),
        countryStats: getTeamStatsForMatch(realMatch, isHome),
        opponentStats: getOpponentStatsForMatch(realMatch, isHome),
        countryEvents: (realMatch?.events ?? []).filter(
          (event) => eventBelongsToCountry(event, realMatch, isHome) && (isGoalEvent(event) || isYellowCardEvent(event) || isRedCardEvent(event))
        )
      }
    })
}

function getQualificationLabel(row: GroupTableRow | undefined, groupPosition: number | null) {
  if (!row || groupPosition === null) return 'Pending'
  if (row.directQualificationStatus === 'qualified') return 'Confirmed direct qualifier'
  if (groupPosition <= 2) return 'Direct place race'
  if (groupPosition === 3) return 'Best third-place race'
  return 'Needs results'
}

function buildPlayerImpact(rows: CountryMatchRow[]) {
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
        captain: 0
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

    getCountryLineupPlayers(row).forEach((lineupPlayer) => {
      const player = getPlayer(lineupPlayer.name)
      player.starts += 1
      if (lineupPlayer.captain) player.captain += 1
    })
  })

  return Array.from(players.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals
    if (b.starts !== a.starts) return b.starts - a.starts
    return a.name.localeCompare(b.name)
  })
}

function getFormationUsage(rows: CountryMatchRow[]) {
  const formations = new Map<string, number>()

  rows.forEach((row) => {
    const lineups = row.realMatch?.lineups
    const formation = row.isHome ? lineups?.homeFormation : lineups?.awayFormation

    if (!formation) return

    formations.set(formation, (formations.get(formation) ?? 0) + 1)
  })

  return Array.from(formations.entries())
    .map(([formation, count]) => ({ formation, count }))
    .sort((a, b) => b.count - a.count)
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

export function CountryPage() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const loading = useRealMatchStore((state) => state.loading)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const { teams, groups, fixtures } = useTournamentData()
  const [selectedTeamId, setSelectedTeamId] = useState('australia')
  const selectedTeam = teams.find((candidate) => candidate.id === selectedTeamId) ?? teams[0]

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
  const groupTable = calculateGroupTable({ group: team.group, teams, fixtures, scores })
  const groupPosition = groupTable.findIndex((row) => row.teamId === team.id) + 1
  const tableRow = groupTable.find((row) => row.teamId === team.id)
  const rows = getCountryMatchRows({ team, teams, fixtures, scores, realMatches })
  const completedRows = rows.filter((row) => row.countryScore !== null && row.opponentScore !== null)
  const statRows = rows.filter((row) => row.countryStats.length)
  const possessionAverage = average(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.possession)))
  const shotsAverage = average(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.totalShots)))
  const shotsOnGoalAverage = average(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.shotsOnGoal)))
  const cornersAverage = average(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.corners)))
  const foulsAverage = average(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.fouls)))
  const opponentShotsOnGoalAverage = average(statRows.map((row) => getStatValue(row.opponentStats, STAT_TYPES.shotsOnGoal)))
  const yellowCards = sum(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.yellowCards)))
  const redCards = sum(statRows.map((row) => getStatValue(row.countryStats, STAT_TYPES.redCards)))
  const goalsPerMatch = tableRow?.played ? tableRow.goalsFor / tableRow.played : 0
  const goalsAgainstPerMatch = tableRow?.played ? tableRow.goalsAgainst / tableRow.played : 0
  const cleanSheets = completedRows.filter((row) => row.opponentScore === 0).length
  const cleanSheetRate = completedRows.length ? cleanSheets / completedRows.length : 0
  const shotAccuracy = shotsAverage && shotsOnGoalAverage ? (shotsOnGoalAverage / shotsAverage) * 100 : null
  const conversionRate = shotsAverage && tableRow?.played ? (tableRow.goalsFor / (shotsAverage * tableRow.played)) * 100 : null
  const attackRating = clampRating(
    goalsPerMatch * 24 + (shotsOnGoalAverage ?? 0) * 12 + (shotsAverage ?? 0) * 4 + (cornersAverage ?? 0) * 4 + (conversionRate ?? 0) * 0.45
  )
  const defenceRating = clampRating(100 - goalsAgainstPerMatch * 24 - (opponentShotsOnGoalAverage ?? 0) * 6 + cleanSheetRate * 20)
  const controlRating = clampRating((possessionAverage ?? 0) * 0.8 + (shotsAverage ?? 0) * 2 + (cornersAverage ?? 0) * 5 - (foulsAverage ?? 0) * 1.2)
  const disciplineRating = clampRating(100 - yellowCards * 8 - redCards * 20 - (foulsAverage ?? 0) * 2)
  const playerImpact = buildPlayerImpact(rows)
  const formationUsage = getFormationUsage(rows)
  const latestLineupRow = [...rows].reverse().find((row) => getCountryLineupPlayers(row).length > 0)
  const latestXi = latestLineupRow ? getCountryLineupPlayers(latestLineupRow) : []
  const espnLoadedCount = rows.filter((row) => row.realMatch).length
  const qualificationLabel = getQualificationLabel(tableRow, groupPosition || null)

  return (
    <div className="grid gap-5 sm:gap-6">
      <section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2rem] sm:p-6 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-yellow-950/20">
                <Sparkles className="size-4" />
                Country intelligence demo
              </span>
              <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-slate-200">
                ESPN stats · no commentary feed
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="flex size-28 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl ring-1 ring-white/10 sm:size-36">
                <TeamFlag code={team.flagCode} label={team.name} size="lg" className="scale-[2.6] sm:scale-[3.25]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
                  {group?.name ?? `Group ${team.group}`} · {team.confederation}
                </p>
                <h1 className="mt-2 text-5xl font-black leading-none tracking-tight text-white sm:text-7xl">
                  {team.name}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10">
                    #{groupPosition || '—'} in Group {team.group}
                  </span>
                  <span className="rounded-full bg-emerald-300/15 px-4 py-2 text-sm font-black text-emerald-200 ring-1 ring-emerald-300/25">
                    {qualificationLabel}
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

      <section className="rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">Country selector</p>
            <h2 className="mt-1 text-2xl font-black text-white">Preview any team profile</h2>
          </div>
          <p className="text-sm font-bold text-slate-400">Demo uses available ESPN fields and calculated metrics.</p>
        </div>
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {teams.map((candidate) => {
            const isActive = candidate.id === team.id

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedTeamId(candidate.id)}
                className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 ${
                  isActive
                    ? 'border-yellow-300/60 bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-950/20'
                    : 'border-white/10 bg-white/8 text-slate-200 hover:border-yellow-300/40 hover:bg-yellow-300/10 hover:text-white'
                }`}
              >
                <TeamFlag code={candidate.flagCode} label={candidate.name} size="sm" />
                {candidate.shortName}
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5">
        <SummaryCard label="Record" value={`${tableRow?.won ?? 0}-${tableRow?.drawn ?? 0}-${tableRow?.lost ?? 0}`} detail="Wins, draws and losses from scored fixtures." icon={Trophy} />
        <SummaryCard label="Goals" value={`${tableRow?.goalsFor ?? 0}:${tableRow?.goalsAgainst ?? 0}`} detail="Goals for and against." icon={Crosshair} tone="emerald" />
        <SummaryCard label="Shots" value={formatNumber(shotsAverage)} detail="Average total shots when ESPN stats are loaded." icon={Zap} tone="sky" />
        <SummaryCard label="Accuracy" value={formatPercent(shotAccuracy)} detail="Shots on goal divided by total shots." icon={Gauge} />
        <SummaryCard label="Cards" value={yellowCards + redCards} detail={`${yellowCards} yellow · ${redCards} red`} icon={Shield} tone="rose" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Performance engine</p>
              <h2 className="mt-2 text-3xl font-black text-white">Generated ratings</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">ESPN-derived</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RatingCard label="Attack rating" value={attackRating} caption="Goals, shots, shots on goal, corners and conversion." icon={TrendingUp} />
            <RatingCard label="Control rating" value={controlRating} caption="Possession, shots, corners and fouls balance." icon={BarChart3} />
            <RatingCard label="Defence rating" value={defenceRating} caption="Goals conceded, clean sheets and opponent pressure." icon={Shield} />
            <RatingCard label="Discipline rating" value={disciplineRating} caption="Fouls, yellow cards and red cards." icon={BadgeCheck} />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Match DNA</p>
              <h2 className="mt-2 text-3xl font-black text-white">Average stat profile</h2>
            </div>
            <p className="max-w-sm text-xs font-bold leading-5 text-slate-400">
              xG is not estimated. It will only show if ESPN provides it directly.
            </p>
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
        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((row) => {
            const possession = getStatValue(row.countryStats, STAT_TYPES.possession)
            const shots = getStatValue(row.countryStats, STAT_TYPES.totalShots)
            const shotsOnGoal = getStatValue(row.countryStats, STAT_TYPES.shotsOnGoal)
            const corners = getStatValue(row.countryStats, STAT_TYPES.corners)
            const statusLabel = row.realMatch?.status.short ?? (isScored(row.score) ? 'FT' : 'NS')

            return (
              <article key={row.fixture.id} className="group rounded-3xl border border-white/10 bg-slate-950/40 p-4 transition hover:-translate-y-1 hover:border-yellow-300/35 hover:bg-slate-950/60">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">Match {row.fixture.matchNumber}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${getResultClassName(row.result)}`}>
                    {getResultLabel(row.result)} · {statusLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{row.isHome ? 'Home' : 'Away'} vs</p>
                    <div className="mt-2 flex items-center gap-2">
                      <TeamFlag code={row.opponent?.flagCode} label={row.opponent?.name} size="md" />
                      <p className="truncate text-lg font-black text-white">{row.opponent?.name ?? 'TBD'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/10">
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
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <CalendarDays className="size-4 text-yellow-300" />
                  <span>{row.fixture.date}</span>
                  <span>·</span>
                  <span className="truncate">{row.realMatch?.venue ?? row.fixture.venue}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Player impact</p>
              <h2 className="mt-2 text-3xl font-black text-white">Goals, cards and starts</h2>
            </div>
            <Medal className="size-8 text-yellow-300" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/70 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                <tr><th className="px-4 py-3">Player</th><th className="px-4 py-3 text-center">G</th><th className="px-4 py-3 text-center">YC</th><th className="px-4 py-3 text-center">RC</th><th className="px-4 py-3 text-center">Starts</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {playerImpact.slice(0, 8).map((player) => (
                  <tr key={player.name} className="bg-white/5 text-slate-200">
                    <td className="px-4 py-3 font-black text-white">
                      {player.name}
                      {player.captain > 0 && <span className="ml-2 rounded-full bg-yellow-300/15 px-2 py-0.5 text-[10px] text-yellow-200">C</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-black">{player.goals}</td>
                    <td className="px-4 py-3 text-center font-black">{player.yellowCards}</td>
                    <td className="px-4 py-3 text-center font-black">{player.redCards}</td>
                    <td className="px-4 py-3 text-center font-black">{player.starts}</td>
                  </tr>
                ))}
                {playerImpact.length === 0 && <tr><td className="px-4 py-5 text-sm font-bold text-slate-400" colSpan={5}>ESPN player events or lineups are not loaded for this country yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Tactical board</p>
              <h2 className="mt-2 text-3xl font-black text-white">Lineup profile</h2>
            </div>
            <Users className="size-8 text-emerald-300" />
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Most used formation</p>
              <p className="mt-2 text-4xl font-black text-white">{formationUsage[0]?.formation ?? '—'}</p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                {formationUsage[0] ? `${formationUsage[0].count} loaded match${formationUsage[0].count === 1 ? '' : 'es'}` : 'Waiting for ESPN lineups'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Latest XI</p>
              <div className="mt-3 grid gap-2">
                {latestXi.slice(0, 11).map((player) => (
                  <div key={`${player.name}-${player.number ?? ''}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/45 px-3 py-2">
                    <span className="truncate text-sm font-black text-white">{player.name}</span>
                    <span className="shrink-0 text-xs font-black text-slate-400">{player.position ?? player.number ?? '—'}</span>
                  </div>
                ))}
                {latestXi.length === 0 && <p className="rounded-xl bg-slate-950/45 px-3 py-4 text-sm font-bold text-slate-400">Latest XI will appear when ESPN lineup data is available.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
