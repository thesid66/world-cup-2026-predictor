import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { canFetchEspnWorldCupMatchData } from '../../services/espnWorldCup'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type {
  RealMatchCommentary,
  RealMatchEvent,
  RealMatchLineupPlayer,
  RealMatchStatistic,
  RealMatchStatus
} from '../../types/realMatch'
import type { Fixture, Team } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type RealMatchModalProps = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
  open: boolean
  onClose: () => void
}

type LoadRealDataStatus = 'idle' | 'copied' | 'unavailable' | 'error'

type UsableActualScore = {
  home: number
  away: number
}

type TimelineEventStyle = {
  icon: string
  cardClass: string
  iconClass: string
  labelClass: string
  teamBadgeClass: string
}

type GoalScorerSummary = {
  playerName: string
  timeLabel: string
}

const featuredStats = [
  'Ball Possession',
  'Total Shots',
  'Shots on Goal',
  'Corner Kicks',
  'Fouls',
  'Yellow Cards',
  'Red Cards',
  'Assists'
]

const modalSections = [
  { id: 'real-match-comparison', label: 'Comparison' },
  { id: 'real-match-lineups', label: 'Lineups' },
  { id: 'real-match-timeline', label: 'Timeline' }
]

function normalizeStatLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeTeamText(value?: string) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normaliseHexColor(value?: string, fallback = '#38bdf8') {
  if (!value) return fallback

  const cleaned = value.replace('#', '').trim()

  if (/^[0-9a-f]{3}$/i.test(cleaned) || /^[0-9a-f]{6}$/i.test(cleaned)) {
    return `#${cleaned}`
  }

  return fallback
}

function normalizeStatusText(status?: RealMatchStatus) {
  return `${status?.short ?? ''} ${status?.long ?? ''}`.toLowerCase()
}

function isFullTimeStatus(status?: RealMatchStatus) {
  const text = normalizeStatusText(status)
  return text.includes('ft') || text.includes('full time') || text.includes('final')
}

function isLiveStatus(status?: RealMatchStatus) {
  if (!status || isFullTimeStatus(status)) return false
  const text = normalizeStatusText(status)
  return text.includes('live') || text.includes('half') || text.includes('progress') || typeof status.elapsed === 'number'
}

function getStatusLabel(status?: RealMatchStatus) {
  if (!status) return null

  if (isLiveStatus(status) && typeof status.elapsed === 'number') {
    const shortLabel = status.short && !/^live$/i.test(status.short) ? status.short : null
    return shortLabel || `LIVE ${status.elapsed}'`
  }

  return status.short || status.long || null
}

function getStatusDetail(status?: RealMatchStatus) {
  if (!status) return null

  const label = getStatusLabel(status)
  const detail = status.long && status.long !== label ? status.long : null
  const elapsed = typeof status.elapsed === 'number' && !String(label ?? '').includes(`${status.elapsed}`)
    ? `${status.elapsed}'`
    : null

  return [detail, elapsed].filter(Boolean).join(' · ') || null
}

function getStatusPillClass(status?: RealMatchStatus) {
  if (isLiveStatus(status)) {
    return 'border-red-300/30 bg-red-400/15 text-red-100 shadow-red-950/20'
  }

  if (isFullTimeStatus(status)) {
    return 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-emerald-950/20'
  }

  return 'border-sky-300/25 bg-sky-300/10 text-sky-100 shadow-sky-950/20'
}

function parseStatNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!value) return null

  const parsedValue = Number(String(value).replace(/[^0-9.-]/g, ''))

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function getStatValue(stats: RealMatchStatistic[], type: string) {
  const normalizedType = normalizeStatLabel(type)
  const item = stats.find((stat) => normalizeStatLabel(stat.type) === normalizedType)

  return item?.value ?? '-'
}

function getAvailableStatTypes(homeStats: RealMatchStatistic[], awayStats: RealMatchStatistic[]) {
  const availableTypes = [...homeStats, ...awayStats]
    .map((stat) => stat.type)
    .filter(Boolean)

  const uniqueTypes = Array.from(new Set(availableTypes))
  const uniqueTypeKeys = new Set(uniqueTypes.map(normalizeStatLabel))

  const matchedFeaturedStats = featuredStats.filter((type) => uniqueTypeKeys.has(normalizeStatLabel(type)))
  const featuredKeys = new Set(matchedFeaturedStats.map(normalizeStatLabel))
  const extraStats = uniqueTypes.filter((type) => !featuredKeys.has(normalizeStatLabel(type)))

  return [...matchedFeaturedStats, ...extraStats]
}

function getComparisonShares(homeValue: string | number | null, awayValue: string | number | null) {
  const homeNumber = parseStatNumber(homeValue)
  const awayNumber = parseStatNumber(awayValue)

  if (homeNumber === null || awayNumber === null) {
    return undefined
  }

  const total = Math.abs(homeNumber) + Math.abs(awayNumber)

  if (!total) {
    return { home: 50, away: 50 }
  }

  return {
    home: Math.max(8, (Math.abs(homeNumber) / total) * 100),
    away: Math.max(8, (Math.abs(awayNumber) / total) * 100)
  }
}

function hasUsableActualScore(
  score?: { home: number | null; away: number | null }
): score is UsableActualScore {
  return typeof score?.home === 'number' && typeof score.away === 'number'
}

function getTimelineTypeText(event: RealMatchEvent) {
  return `${event.type ?? ''} ${event.detail ?? ''}`.toLowerCase()
}

function isTimelineSubstitution(event: RealMatchEvent) {
  return getTimelineTypeText(event).includes('substitution')
}

function isTimelineVar(event: RealMatchEvent) {
  return getTimelineTypeText(event).includes('var')
}

function isTimelinePenalty(event: RealMatchEvent) {
  return getTimelineTypeText(event).includes('penalty')
}

function isTimelineRedCard(event: RealMatchEvent) {
  const typeText = getTimelineTypeText(event)

  return typeText.includes('red') && typeText.includes('card')
}

function isTimelineYellowCard(event: RealMatchEvent) {
  const typeText = getTimelineTypeText(event)

  return typeText.includes('yellow') && typeText.includes('card') && !isTimelineRedCard(event)
}

function isTimelineGoal(event: RealMatchEvent) {
  const typeText = getTimelineTypeText(event)

  return typeText.includes('goal') || typeText.includes('penalty - scored')
}

function getTimelineTypeLabel(event: RealMatchEvent) {
  if (isTimelineSubstitution(event)) return 'Substitution'
  if (isTimelineVar(event)) return 'VAR check'
  if (isTimelineRedCard(event)) return 'Red card'
  if (isTimelineYellowCard(event)) return 'Yellow card'
  if (isTimelinePenalty(event)) return 'Penalty'
  if (isTimelineGoal(event)) return 'Goal'

  return event.type || 'Event'
}

function getTimelineEventStyle(event: RealMatchEvent): TimelineEventStyle {
  if (isTimelineGoal(event) || isTimelinePenalty(event)) {
    return {
      icon: isTimelinePenalty(event) ? '◎' : '⚽',
      cardClass: 'border-emerald-300/25 bg-emerald-300/10',
      iconClass: 'border-emerald-300/30 bg-emerald-300/20 text-xl text-emerald-50',
      labelClass: 'text-emerald-200',
      teamBadgeClass: 'bg-emerald-300/15 text-emerald-100'
    }
  }

  if (isTimelineSubstitution(event)) {
    return {
      icon: '⇄',
      cardClass: 'border-sky-300/25 bg-sky-300/10',
      iconClass: 'border-sky-300/30 bg-sky-300/20 text-sky-100',
      labelClass: 'text-sky-200',
      teamBadgeClass: 'bg-sky-300/15 text-sky-100'
    }
  }

  if (isTimelineVar(event)) {
    return {
      icon: '📺',
      cardClass: 'border-violet-300/25 bg-violet-300/10',
      iconClass: 'border-violet-300/30 bg-violet-300/20 text-lg',
      labelClass: 'text-violet-200',
      teamBadgeClass: 'bg-violet-300/15 text-violet-100'
    }
  }

  if (isTimelineRedCard(event)) {
    return {
      icon: 'red-card',
      cardClass: 'border-red-300/25 bg-red-300/10',
      iconClass: 'border-red-300/30 bg-red-300/20',
      labelClass: 'text-red-200',
      teamBadgeClass: 'bg-red-300/15 text-red-100'
    }
  }

  if (isTimelineYellowCard(event)) {
    return {
      icon: 'yellow-card',
      cardClass: 'border-yellow-300/25 bg-yellow-300/10',
      iconClass: 'border-yellow-300/30 bg-yellow-300/20',
      labelClass: 'text-yellow-200',
      teamBadgeClass: 'bg-yellow-300/15 text-yellow-100'
    }
  }

  return {
    icon: '•',
    cardClass: 'border-white/10 bg-slate-950/45',
    iconClass: 'border-white/10 bg-white/8 text-slate-300',
    labelClass: 'text-slate-400',
    teamBadgeClass: 'bg-white/8 text-slate-300'
  }
}

function getTimelineTimeLabel(event: RealMatchEvent) {
  if (event.timeLabel) return event.timeLabel

  const minute = typeof event.elapsed === 'number' ? event.elapsed : '-'
  const extra = event.extra ? `+${event.extra}` : ''

  return `${minute}${extra}'`
}

function getTimelinePrimaryText(event: RealMatchEvent) {
  return event.displayText || event.playerName || event.secondaryPlayerName || event.detail || ''
}

function getTimelineMetaParts(event: RealMatchEvent) {
  const parts: string[] = []

  if (event.assistName) parts.push(`Assist: ${event.assistName}`)
  if (event.scoreDisplay) parts.push(`Score: ${event.scoreDisplay}`)

  return parts
}

function getGoalScorersForTeam(events: RealMatchEvent[], teamName?: string): GoalScorerSummary[] {
  const normalizedTeamName = normalizeTeamText(teamName)

  if (!normalizedTeamName) return []

  return events
    .filter(isTimelineGoal)
    .filter((event) => normalizeTeamText(event.teamName) === normalizedTeamName)
    .map((event) => ({
      playerName: getTimelinePrimaryText(event) || 'Unknown scorer',
      timeLabel: getTimelineTimeLabel(event)
    }))
}

function scrollToModalSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderGoalScorers(scorers: GoalScorerSummary[], alignment: 'left' | 'right') {
  if (!scorers.length) return null

  return (
    <div className={`mt-2 grid gap-1 ${alignment === 'right' ? 'justify-items-end' : ''}`}>
      {scorers.map((scorer, index) => (
        <p
          key={`${scorer.playerName}-${scorer.timeLabel}-${index}`}
          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black text-emerald-100 sm:text-xs"
        >
          <span>{scorer.playerName}</span>
          <span className="ml-1 text-emerald-300">{scorer.timeLabel}</span>
        </p>
      ))}
    </div>
  )
}

function renderTimelineIcon(style: TimelineEventStyle) {
  if (style.icon === 'red-card') {
    return (
      <span
        className="block h-5 w-3 rounded-[2px] border border-red-100/50 bg-red-500 shadow-lg"
        aria-label="Red card"
      />
    )
  }

  if (style.icon === 'yellow-card') {
    return (
      <span
        className="block h-5 w-3 rounded-[2px] border border-yellow-100/60 bg-yellow-300 shadow-lg"
        aria-label="Yellow card"
      />
    )
  }

  return <span aria-hidden="true">{style.icon}</span>
}

function renderSubstitutionDetails(event: RealMatchEvent) {
  const playerIn = event.playerName
  const playerOut = event.secondaryPlayerName

  if (!playerIn && !playerOut) return null

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {playerIn && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-lg font-black text-emerald-100">
            ↗
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              Player in
            </p>
            <p className="truncate text-sm font-black text-white">{playerIn}</p>
          </div>
        </div>
      )}

      {playerOut && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-300/20 text-lg font-black text-red-100">
            ↙
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200">
              Player out
            </p>
            <p className="truncate text-sm font-black text-white">{playerOut}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function renderLineupPlayerList(players: RealMatchLineupPlayer[], emptyMessage: string) {
  if (!players.length) {
    return <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="grid gap-2">
      {players.map((player, index) => (
        <div
          key={`${player.number ?? index}-${player.name}`}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
        >
          <p className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/8 px-2 text-xs font-black text-slate-300">
            {player.number ?? '-'}
          </p>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{player.name}</p>
            {player.captain && <p className="text-[10px] font-black uppercase text-yellow-200">Captain</p>}
          </div>
          {player.position && (
            <p className="rounded-full bg-sky-300/10 px-2 py-1 text-[10px] font-black uppercase text-sky-200">
              {player.position}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function renderComparisonRow({
  statType,
  homeStats,
  awayStats,
  homeColor,
  awayColor
}: {
  statType: string
  homeStats: RealMatchStatistic[]
  awayStats: RealMatchStatistic[]
  homeColor: string
  awayColor: string
}) {
  const homeValue = getStatValue(homeStats, statType)
  const awayValue = getStatValue(awayStats, statType)
  const shares = getComparisonShares(homeValue, awayValue)

  return (
    <div key={statType} className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="text-right text-sm font-black text-white sm:text-base">{homeValue}</p>
        <p className="min-w-28 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:min-w-40 sm:text-xs">
          {statType}
        </p>
        <p className="text-sm font-black text-white sm:text-base">{awayValue}</p>
      </div>

      {shares ? (
        <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="transition-all"
            style={{ width: `${shares.home}%`, backgroundColor: homeColor }}
          />
          <div
            className="transition-all"
            style={{ width: `${shares.away}%`, backgroundColor: awayColor }}
          />
        </div>
      ) : (
        <div className="h-3 rounded-full bg-white/10" />
      )}
    </div>
  )
}

function renderTeamLineup({
  title,
  teamName,
  formation,
  coach,
  starters,
  substitutes,
  accentClass
}: {
  title: string
  teamName: string
  formation?: string | null
  coach?: string | null
  starters: RealMatchLineupPlayer[]
  substitutes: RealMatchLineupPlayer[]
  accentClass: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${accentClass}`}>{title}</p>
          <h4 className="mt-1 text-lg font-black text-white">{teamName}</h4>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs font-black text-slate-300">
          {formation && <p className="rounded-full bg-white/8 px-3 py-1">{formation}</p>}
          {coach && <p className="rounded-full bg-white/8 px-3 py-1">Coach: {coach}</p>}
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Starting XI
          </p>
          {renderLineupPlayerList(starters, 'Starting XI not available from ESPN yet.')}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Bench
          </p>
          {renderLineupPlayerList(substitutes, 'Bench not available from ESPN yet.')}
        </div>
      </div>
    </div>
  )
}

function renderCommentaryItem(item: RealMatchCommentary, index: number) {
  return (
    <div
      key={`${item.id ?? index}-${item.text}`}
      className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          {item.timeLabel || (typeof item.elapsed === 'number' ? `${item.elapsed}'` : 'Commentary')}
        </p>
        {item.teamName && (
          <p className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
            {item.teamName}
          </p>
        )}
      </div>
      <p className="text-sm font-bold leading-6 text-slate-200">{item.text}</p>
      {item.playerName && <p className="mt-2 text-xs font-black text-sky-200">{item.playerName}</p>}
    </div>
  )
}

export function RealMatchModal({
  fixture,
  homeTeam,
  awayTeam,
  open,
  onClose
}: RealMatchModalProps) {
  const [loadRealDataStatus, setLoadRealDataStatus] = useState<LoadRealDataStatus>('idle')
  const [copyingRealData, setCopyingRealData] = useState(false)

  const matchData = useRealMatchStore((state) => state.matches[fixture.id])
  const loading = useRealMatchStore((state) => state.loading[fixture.id])
  const error = useRealMatchStore((state) => state.errors[fixture.id])
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const updateScore = usePredictionStore((state) => state.updateScore)

  useEffect(() => {
    if (open) {
      const cachedMatch = useRealMatchStore.getState().matches[fixture.id]
      const shouldForceRefresh = !cachedMatch?.statistics.length && !cachedMatch?.events.length

      void fetchMatchData(fixture, shouldForceRefresh)
    }
  }, [fetchMatchData, fixture, open])

  useEffect(() => {
    if (!open) {
      setLoadRealDataStatus('idle')
      setCopyingRealData(false)
    }
  }, [open])

  if (!open) return null

  const homeStats = matchData?.statistics[0]?.statistics ?? []
  const awayStats = matchData?.statistics[1]?.statistics ?? []
  const availableStatTypes = getAvailableStatTypes(homeStats, awayStats)
  const homeLineupPlayers = matchData?.lineups?.homeXi ?? []
  const awayLineupPlayers = matchData?.lineups?.awayXi ?? []
  const homeBenchPlayers = matchData?.lineups?.homeSubs ?? []
  const awayBenchPlayers = matchData?.lineups?.awaySubs ?? []
  const hasLineupSummary = Boolean(
    homeLineupPlayers.length || awayLineupPlayers.length || homeBenchPlayers.length || awayBenchPlayers.length
  )
  const hasEspnData = canFetchEspnWorldCupMatchData(fixture)
  const isLoadRealDataDisabled = !hasEspnData || loading || copyingRealData
  const homeDisplayName = matchData?.homeTeam.name ?? homeTeam?.name ?? 'Home'
  const awayDisplayName = matchData?.awayTeam.name ?? awayTeam?.name ?? 'Away'
  const homeColor = normaliseHexColor(matchData?.homeTeam.color, '#10b981')
  const awayColor = normaliseHexColor(matchData?.awayTeam.color, '#38bdf8')
  const homeScorers = getGoalScorersForTeam(matchData?.events ?? [], homeDisplayName)
  const awayScorers = getGoalScorersForTeam(matchData?.events ?? [], awayDisplayName)
  const hasTimelineContent = Boolean(matchData?.events.length || matchData?.commentary?.length)
  const statusLabel = getStatusLabel(matchData?.status)
  const statusDetail = getStatusDetail(matchData?.status)
  const statusPillClass = getStatusPillClass(matchData?.status)

  async function handleLoadRealData() {
    if (!hasEspnData || copyingRealData) return

    setCopyingRealData(true)
    setLoadRealDataStatus('idle')

    try {
      await fetchMatchData(fixture, true)

      const latestRealMatch = useRealMatchStore.getState().matches[fixture.id]
      const latestScore = latestRealMatch?.score

      if (!hasUsableActualScore(latestScore)) {
        setLoadRealDataStatus('unavailable')
        return
      }

      updateScore(fixture.id, 'homeScore', latestScore.home)
      updateScore(fixture.id, 'awayScore', latestScore.away)
      setLoadRealDataStatus('copied')
    } catch {
      setLoadRealDataStatus('error')
    } finally {
      setCopyingRealData(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <article
        className="max-h-[94svh] w-full max-w-5xl scroll-smooth overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-300">
                ESPN match data
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-white">Match {fixture.matchNumber}</h2>
                {statusLabel && (
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-lg ${statusPillClass}`}>
                    {statusLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {matchData?.venue ?? fixture.venue}, {matchData?.venueCity || fixture.city}
              </p>
              {statusDetail && <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{statusDetail}</p>}
              {matchData?.broadcasts?.length ? (
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Watch: {matchData.broadcasts.slice(0, 4).join(' · ')}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={isLoadRealDataDisabled}
                onClick={handleLoadRealData}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              >
                {copyingRealData || loading ? 'Loading real data...' : 'Load real data'}
              </button>

              <button
                type="button"
                onClick={() => fetchMatchData(fixture, true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/15"
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-slate-300 transition hover:bg-red-400/15 hover:text-red-200"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {modalSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToModalSection(section.id)}
                className="shrink-0 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:border-sky-300/30 hover:bg-sky-300/10 hover:text-sky-100"
              >
                {section.label}
              </button>
            ))}
          </nav>

          {loadRealDataStatus !== 'idle' && (
            <p
              className={`mt-3 text-right text-xs font-bold ${
                loadRealDataStatus === 'copied'
                  ? 'text-emerald-200'
                  : loadRealDataStatus === 'unavailable'
                    ? 'text-yellow-200'
                    : 'text-red-200'
              }`}
            >
              {loadRealDataStatus === 'copied'
                ? 'Prediction replaced with actual score.'
                : loadRealDataStatus === 'unavailable'
                  ? 'Actual score is not available yet.'
                  : 'Could not load real data.'}
            </p>
          )}
        </header>

        <div className="p-4 sm:p-5">
          <section className="rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4">
              <div className="min-w-0 text-center sm:flex sm:items-start sm:gap-3 sm:text-left">
                <div className="mb-2 flex justify-center sm:mb-0">
                  <TeamFlag code={homeTeam?.flagCode} label={homeDisplayName} size="md" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white sm:text-lg">{homeDisplayName}</p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {matchData?.homeTeam.record ? `Record: ${matchData.homeTeam.record}` : homeTeam?.shortName}
                  </p>
                  {matchData?.homeTeam.form && (
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Form: {matchData.homeTeam.form}
                    </p>
                  )}
                  {renderGoalScorers(homeScorers, 'left')}
                </div>
              </div>

              <div className="flex min-w-[92px] flex-col items-center rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-3 text-center sm:min-w-[150px] sm:px-6 sm:py-4">
                <p className="w-full text-center text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200 sm:text-xs sm:tracking-[0.2em]">
                  Actual
                </p>
                {statusLabel && (
                  <p className={`mx-auto mt-2 w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] shadow-lg ${statusPillClass}`}>
                    {statusLabel}
                  </p>
                )}
                <p className="mt-2 w-full whitespace-nowrap text-center text-2xl font-black text-white sm:text-4xl">
                  {matchData?.score.display ?? '- - -'}
                </p>
                <p className="mx-auto mt-1 w-full max-w-[88px] text-center text-[10px] font-bold leading-4 text-slate-400 sm:max-w-none sm:text-xs">
                  {statusDetail || matchData?.status.long || 'Not loaded'}
                </p>
              </div>

              <div className="min-w-0 text-center sm:flex sm:items-start sm:justify-end sm:gap-3 sm:text-right">
                <div className="mb-2 flex justify-center sm:order-2 sm:mb-0">
                  <TeamFlag code={awayTeam?.flagCode} label={awayDisplayName} size="md" />
                </div>
                <div className="min-w-0 sm:order-1">
                  <p className="truncate text-xs font-black text-white sm:text-lg">{awayDisplayName}</p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {matchData?.awayTeam.record ? `Record: ${matchData.awayTeam.record}` : awayTeam?.shortName}
                  </p>
                  {matchData?.awayTeam.form && (
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Form: {matchData.awayTeam.form}
                    </p>
                  )}
                  {renderGoalScorers(awayScorers, 'right')}
                </div>
              </div>
            </div>

            {matchData?.headline && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-bold leading-6 text-slate-200">{matchData.headline}</p>
              </div>
            )}

            {!hasEspnData && (
              <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-yellow-100">
                  ESPN World Cup data is not available for this fixture yet.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-red-100">{error}</p>
              </div>
            )}

            {loading && (
              <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-sky-100">Loading ESPN data...</p>
              </div>
            )}
          </section>

          <section
            id="real-match-comparison"
            className="mt-5 scroll-mt-40 rounded-3xl border border-white/10 bg-white/8 p-5"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                  Comparison
                </p>
                <h3 className="mt-1 text-xl font-black text-white">Team comparison</h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-black text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: homeColor }} />
                  {homeTeam?.shortName ?? homeDisplayName}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: awayColor }} />
                  {awayTeam?.shortName ?? awayDisplayName}
                </span>
              </div>
            </div>

            {availableStatTypes.length ? (
              <div className="grid gap-3">
                {availableStatTypes.map((statType) =>
                  renderComparisonRow({ statType, homeStats, awayStats, homeColor, awayColor })
                )}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                {loading
                  ? 'Loading team comparison from ESPN...'
                  : 'Team comparison will appear here when ESPN has match statistics for this fixture.'}
              </p>
            )}
          </section>

          <section
            id="real-match-lineups"
            className="mt-5 scroll-mt-40 rounded-3xl border border-white/10 bg-white/8 p-5"
          >
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-300">
                Lineups
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Starting XI and bench</h3>
            </div>

            {hasLineupSummary ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {renderTeamLineup({
                  title: 'Home lineup',
                  teamName: homeDisplayName,
                  formation: matchData?.lineups?.homeFormation,
                  coach: matchData?.lineups?.homeCoach,
                  starters: homeLineupPlayers,
                  substitutes: homeBenchPlayers,
                  accentClass: 'text-emerald-200'
                })}
                {renderTeamLineup({
                  title: 'Away lineup',
                  teamName: awayDisplayName,
                  formation: matchData?.lineups?.awayFormation,
                  coach: matchData?.lineups?.awayCoach,
                  starters: awayLineupPlayers,
                  substitutes: awayBenchPlayers,
                  accentClass: 'text-sky-200'
                })}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                {loading
                  ? 'Checking ESPN lineup data...'
                  : 'Lineups will appear here when ESPN exposes starting XI or bench data for this match.'}
              </p>
            )}
          </section>

          <section
            id="real-match-timeline"
            className="mt-5 scroll-mt-40 rounded-3xl border border-white/10 bg-white/8 p-5"
          >
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Timeline
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Events and commentary</h3>
            </div>

            {matchData?.events.length ? (
              <div className="grid gap-3">
                {matchData.events.map((event, index) => {
                  const primaryText = getTimelinePrimaryText(event)
                  const metaParts = getTimelineMetaParts(event)
                  const eventStyle = getTimelineEventStyle(event)
                  const isSubstitution = isTimelineSubstitution(event)

                  return (
                    <div
                      key={`${event.elapsed}-${primaryText}-${index}`}
                      className={`rounded-2xl border p-4 ${eventStyle.cardClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-base font-black ${eventStyle.iconClass}`}
                        >
                          {renderTimelineIcon(eventStyle)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className={`text-xs font-black uppercase tracking-[0.2em] ${eventStyle.labelClass}`}>
                                {getTimelineTypeLabel(event)}
                              </p>
                              <p className="mt-1 text-lg font-black text-white">
                                {getTimelineTimeLabel(event)}
                              </p>
                            </div>
                            {event.teamName && (
                              <p
                                className={`rounded-full px-3 py-1 text-xs font-black ${eventStyle.teamBadgeClass}`}
                              >
                                {event.teamName}
                              </p>
                            )}
                          </div>
                          {isSubstitution ? (
                            renderSubstitutionDetails(event)
                          ) : (
                            primaryText && (
                              <p className="mt-2 text-sm font-bold text-slate-300">{primaryText}</p>
                            )
                          )}
                          {metaParts.length > 0 && (
                            <p className="mt-2 text-xs font-bold text-slate-400">
                              {metaParts.join(' · ')}
                            </p>
                          )}
                          {event.detail && event.detail !== primaryText && (
                            <p className="mt-1 text-xs font-bold text-slate-500">{event.detail}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {matchData?.commentary?.length ? (
              <div className={matchData.events.length ? 'mt-5 border-t border-white/10 pt-5' : ''}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Commentary
                  </p>
                  <p className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    ESPN feed
                  </p>
                </div>
                <div className="grid gap-3">
                  {matchData.commentary.map(renderCommentaryItem)}
                </div>
              </div>
            ) : null}

            {!hasTimelineContent && (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                Goals, cards, VAR checks, substitutions and ESPN commentary will appear here when available.
              </p>
            )}
          </section>
        </div>
      </article>
    </div>,
    document.body
  )
}
