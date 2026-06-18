import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { Fixture, Team } from '../../types/tournament'
import type { RealMatchEvent, RealMatchStatistic } from '../../types/realMatch'
import { canFetchSportScoreMatchData } from '../../services/sportScore'
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

const featuredStats = [
  'Ball Possession',
  'Total Shots',
  'Shots on Goal',
  'Corner Kicks',
  'Fouls',
  'Yellow Cards',
  'Red Cards'
]

function normalizeStatLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
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

  return typeText.includes('goal') && !typeText.includes('own goal cancelled')
}

function getTimelineTypeLabel(event: RealMatchEvent) {
  if (isTimelineSubstitution(event)) return 'Substitution'
  if (isTimelineVar(event)) return 'VAR check'
  if (isTimelineRedCard(event)) return 'Red card'
  if (isTimelineYellowCard(event)) return 'Yellow card'
  if (isTimelineGoal(event)) return 'Goal'

  return event.type || 'Event'
}

function getTimelineEventStyle(event: RealMatchEvent): TimelineEventStyle {
  if (isTimelineGoal(event)) {
    return {
      icon: '⚽',
      cardClass: 'border-emerald-300/25 bg-emerald-300/10',
      iconClass: 'border-emerald-300/30 bg-emerald-300/20 text-xl',
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
  const minute = typeof event.elapsed === 'number' ? event.elapsed : '-'
  const extra = event.extra ? `+${event.extra}` : ''

  return `${minute}${extra}'`
}

function getTimelinePrimaryText(event: RealMatchEvent) {
  return event.displayText || event.playerName || event.secondaryPlayerName || event.detail || ''
}

function getTimelineMetaParts(event: RealMatchEvent) {
  const parts: string[] = []

  if (event.assistName) {
    parts.push(`Assist: ${event.assistName}`)
  }

  if (event.scoreDisplay) {
    parts.push(`Score: ${event.scoreDisplay}`)
  }

  return parts
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

  if (!playerIn && !playerOut) {
    return null
  }

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

function normalizeTeamLabel(value?: string) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
}

function getSubstitutionEventsForTeam(events: RealMatchEvent[], teamNames: Array<string | undefined>) {
  const teamKeys = new Set(teamNames.map(normalizeTeamLabel).filter(Boolean))

  return events.filter((event) => {
    if (!isTimelineSubstitution(event)) return false
    if (!teamKeys.size) return false

    return teamKeys.has(normalizeTeamLabel(event.teamName))
  })
}

function renderSubstitutionSummaryList(substitutions: RealMatchEvent[], emptyMessage: string) {
  if (!substitutions.length) {
    return <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="grid gap-3">
      {substitutions.map((event, index) => (
        <div
          key={`${event.elapsed}-${event.playerName}-${event.secondaryPlayerName}-${index}`}
          className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-white">{getTimelineTimeLabel(event)}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">
              Substitution
            </p>
          </div>

          {renderSubstitutionDetails(event)}
        </div>
      ))}
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
      const shouldForceRefresh = !cachedMatch?.statistics.length

      void fetchMatchData(fixture, shouldForceRefresh)
    }
  }, [fetchMatchData, fixture, open])

  useEffect(() => {
    if (!open) {
      setLoadRealDataStatus('idle')
      setCopyingRealData(false)
    }
  }, [open])

  if (!open) {
    return null
  }

  const homeStats = matchData?.statistics[0]?.statistics ?? []
  const awayStats = matchData?.statistics[1]?.statistics ?? []
  const availableStatTypes = getAvailableStatTypes(homeStats, awayStats)
  const homeSubstitutions = getSubstitutionEventsForTeam(matchData?.events ?? [], [
    matchData?.homeTeam.name,
    homeTeam?.name,
    homeTeam?.shortName
  ])
  const awaySubstitutions = getSubstitutionEventsForTeam(matchData?.events ?? [], [
    matchData?.awayTeam.name,
    awayTeam?.name,
    awayTeam?.shortName
  ])
  const hasSubstitutionSummary = Boolean(homeSubstitutions.length || awaySubstitutions.length)
  const hasSportScoreData = canFetchSportScoreMatchData(fixture)
  const isLoadRealDataDisabled = !hasSportScoreData || loading || copyingRealData

  async function handleLoadRealData() {
    if (!hasSportScoreData || copyingRealData) {
      return
    }

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
        className="max-h-[94svh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-300">
                SportScore match data
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">Match {fixture.matchNumber}</h2>

              <p className="mt-1 text-sm font-bold text-slate-500">
                {fixture.venue}, {fixture.city}
              </p>
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

        <div className="p-5">
          <section className="rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="min-w-0 text-center sm:flex sm:items-center sm:gap-3 sm:text-left">
                <div className="mb-2 flex justify-center sm:mb-0">
                  <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="md" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white sm:text-lg">
                    {homeTeam?.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {homeTeam?.shortName}
                  </p>
                </div>
              </div>

              <div className="flex min-w-[92px] flex-col items-center rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-3 text-center sm:min-w-[150px] sm:px-6 sm:py-4">
                <p className="w-full text-center text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200 sm:text-xs sm:tracking-[0.2em]">
                  Actual
                </p>

                <p className="mt-1 w-full whitespace-nowrap text-center text-2xl font-black text-white sm:text-4xl">
                  {matchData?.score.display ?? '- - -'}
                </p>

                <p className="mx-auto mt-1 w-full max-w-[88px] truncate text-center text-[10px] font-bold text-slate-400 sm:max-w-none sm:text-xs">
                  {matchData?.status.long ?? 'Not loaded'}
                </p>
              </div>

              <div className="min-w-0 text-center sm:flex sm:items-center sm:justify-end sm:gap-3 sm:text-right">
                <div className="mb-2 flex justify-center sm:order-2 sm:mb-0">
                  <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="md" />
                </div>

                <div className="min-w-0 sm:order-1">
                  <p className="truncate text-xs font-black text-white sm:text-lg">
                    {awayTeam?.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {awayTeam?.shortName}
                  </p>
                </div>
              </div>
            </div>

            {!hasSportScoreData && (
              <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-yellow-100">
                  SportScore data is not available for this fixture yet.
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
                <p className="text-sm font-bold leading-6 text-sky-100">
                  Loading SportScore data...
                </p>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Match statistics
              </p>
              <h3 className="mt-1 text-xl font-black text-white">
                {availableStatTypes.length ? 'Team comparison' : 'Substitutions'}
              </h3>
            </div>

            {availableStatTypes.length ? (
              <div className="grid gap-3">
                {availableStatTypes.map((statType) => (
                  <div
                    key={statType}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                  >
                    <p className="text-right text-sm font-black text-white">
                      {getStatValue(homeStats, statType)}
                    </p>

                    <p className="min-w-40 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      {statType}
                    </p>

                    <p className="text-sm font-black text-white">
                      {getStatValue(awayStats, statType)}
                    </p>
                  </div>
                ))}
              </div>
            ) : hasSubstitutionSummary ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                      Home substitutions
                    </p>
                    <p className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
                      {homeTeam?.shortName ?? matchData?.homeTeam.name ?? 'Home'}
                    </p>
                  </div>

                  {renderSubstitutionSummaryList(homeSubstitutions, 'No home substitutions available.')}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">
                      Away substitutions
                    </p>
                    <p className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
                      {awayTeam?.shortName ?? matchData?.awayTeam.name ?? 'Away'}
                    </p>
                  </div>

                  {renderSubstitutionSummaryList(awaySubstitutions, 'No away substitutions available.')}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                {loading
                  ? 'Loading team comparison from SportScore...'
                  : 'Statistics and substitutions will appear here when SportScore has data for this fixture.'}
              </p>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Events
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Match timeline</h3>
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
                              <p className="mt-2 text-sm font-bold text-slate-300">
                                {primaryText}
                              </p>
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
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                Goals, cards, VAR checks and substitutions will appear here when available.
              </p>
            )}
          </section>
        </div>
      </article>
    </div>,
    document.body
  )
}
