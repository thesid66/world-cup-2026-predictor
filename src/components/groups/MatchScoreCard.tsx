import { useEffect, useState, type MouseEvent } from 'react'
import type { Fixture, Team } from '../../types/tournament'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { formatLocalFixtureDateTime, getFixtureKickoffDate } from '../../utils/fixtureTime'
import { canFetchEspnWorldCupMatchData } from '../../services/espnWorldCup'
import { RealMatchModal } from '../matches/RealMatchModal'
import { TeamFlag } from '../ui/TeamFlag'

type MatchScoreCardProps = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
  domId?: string
  highlighted?: boolean
  showCountdown?: boolean
  hideLoadRealDataButton?: boolean
}

type LoadRealDataStatus = 'idle' | 'copied' | 'unavailable' | 'error'

type UsableActualScore = {
  home: number
  away: number
}

type RealStatusLike = {
  long?: string
  short?: string
  elapsed?: number | null
}

function parseScoreValue(value: string): number | null {
  if (value === '') return null

  const parsed = Number(value)

  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function hasUsableActualScore(
  score?: { home: number | null; away: number | null }
): score is UsableActualScore {
  return typeof score?.home === 'number' && typeof score.away === 'number'
}

function formatCountdownTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`

  return `${seconds}s`
}

function normalizeStatusText(status?: RealStatusLike) {
  return `${status?.short ?? ''} ${status?.long ?? ''}`.toLowerCase()
}

function isFullTimeStatus(status?: RealStatusLike) {
  const text = normalizeStatusText(status)
  return text.includes('ft') || text.includes('full time') || text.includes('final')
}

function isLiveStatus(status?: RealStatusLike) {
  if (!status || isFullTimeStatus(status)) return false
  const text = normalizeStatusText(status)
  return text.includes('live') || text.includes('half') || text.includes('progress') || typeof status.elapsed === 'number'
}

function getStatusLabel(status?: RealStatusLike) {
  if (!status) return null

  if (isLiveStatus(status) && typeof status.elapsed === 'number') {
    const shortLabel = status.short && !/^live$/i.test(status.short) ? status.short : null
    return shortLabel || `LIVE ${status.elapsed}'`
  }

  return status.short || status.long || null
}

function getStatusDetail(status?: RealStatusLike) {
  if (!status) return null

  const label = getStatusLabel(status)
  const detail = status.long && status.long !== label ? status.long : null
  const elapsed = typeof status.elapsed === 'number' && !String(label ?? '').includes(`${status.elapsed}`)
    ? `${status.elapsed}'`
    : null

  return [detail, elapsed].filter(Boolean).join(' · ') || null
}

function getCountdownLabel(fixture: Fixture, now: number, status?: RealStatusLike) {
  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!kickoffDate) return null

  const millisecondsToKickoff = kickoffDate.getTime() - now

  if (millisecondsToKickoff <= 0) {
    if (status && !isFullTimeStatus(status)) {
      return getStatusDetail(status) || getStatusLabel(status) || 'Match in progress'
    }

    return 'Match started'
  }

  return `Kickoff in ${formatCountdownTime(millisecondsToKickoff)}`
}

function getStatusPillClass(status?: RealStatusLike) {
  if (isLiveStatus(status)) {
    return 'border-red-300/30 bg-red-400/15 text-red-100 shadow-red-950/20'
  }

  if (isFullTimeStatus(status)) {
    return 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-emerald-950/20'
  }

  return 'border-sky-300/25 bg-sky-300/10 text-sky-100 shadow-sky-950/20'
}

export function MatchScoreCard({
  fixture,
  homeTeam,
  awayTeam,
  domId,
  highlighted = false,
  showCountdown = false,
  hideLoadRealDataButton = false
}: MatchScoreCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loadRealDataStatus, setLoadRealDataStatus] = useState<LoadRealDataStatus>('idle')
  const [copyingRealData, setCopyingRealData] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())

  const score = usePredictionStore((state) => state.scores[fixture.id])
  const updateScore = usePredictionStore((state) => state.updateScore)

  const realMatch = useRealMatchStore((state) => state.matches[fixture.id])
  const realMatchLoading = useRealMatchStore((state) => state.loading[fixture.id])
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)

  const isCompleted = typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  const savedScoreLabel = isCompleted ? `${score.homeScore} - ${score.awayScore}` : null
  const hasEspnData = canFetchEspnWorldCupMatchData(fixture)
  const isLoadRealDataDisabled = !hasEspnData || realMatchLoading || copyingRealData
  const statusLabel = getStatusLabel(realMatch?.status)
  const statusDetail = getStatusDetail(realMatch?.status)
  const statusPillClass = getStatusPillClass(realMatch?.status)
  const countdownLabel = showCountdown ? getCountdownLabel(fixture, currentTime, realMatch?.status) : null

  const actualScoreLabel = realMatch
    ? realMatch.score.display
    : savedScoreLabel
      ? savedScoreLabel
      : hasEspnData
        ? realMatchLoading
          ? 'Loading...'
          : 'Not loaded'
        : 'Not linked'

  const actualScoreDetail = statusDetail || (!realMatch && savedScoreLabel ? 'Saved score' : null)

  useEffect(() => {
    if (!showCountdown) return

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    setCurrentTime(Date.now())

    return () => {
      window.clearInterval(timer)
    }
  }, [showCountdown])

  async function handleLoadRealData(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()

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

  return (
    <>
      <article
        id={domId}
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') setModalOpen(true)
        }}
        className={`group scroll-mt-24 cursor-pointer overflow-hidden rounded-2xl border p-3 shadow-lg transition hover:-translate-y-0.5 sm:scroll-mt-28 sm:p-4 ${
          highlighted
            ? 'live-golden-shadow border-yellow-200/70 bg-yellow-300/15 ring-4 ring-yellow-300/40'
            : isCompleted
              ? 'border-emerald-300/25 bg-emerald-300/10'
              : 'border-white/10 bg-slate-950/45 hover:border-yellow-300/25 hover:bg-white/8'
        }`}
      >
        <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                isCompleted
                  ? 'bg-emerald-300 text-emerald-950'
                  : 'bg-yellow-300/10 text-yellow-200 ring-1 ring-yellow-300/20'
              }`}
            >
              Match {fixture.matchNumber}
            </span>

            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-400">
              Group {fixture.group}
            </span>

            {statusLabel && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] shadow-lg ${statusPillClass}`}
              >
                {statusLabel}
              </span>
            )}

            <span className="min-w-0 text-xs font-bold text-slate-500">{fixture.city}</span>
          </div>

          {countdownLabel && (
            <span className="w-full rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-yellow-100 sm:w-auto sm:py-1 sm:text-xs sm:tracking-[0.14em]">
              {countdownLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
          <div className="min-w-0 text-left">
            <div className="mb-2 flex justify-start">
              <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="lg" />
            </div>
            <p className="truncate text-base font-black text-white sm:text-lg">{homeTeam?.name ?? fixture.homeTeamId}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {homeTeam?.shortName ?? 'Home'}
            </p>
          </div>

          <div className="min-w-[11.5rem] max-w-[13rem] rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-center sm:min-w-[13rem] sm:p-4">
            <div className="mb-3 flex items-center justify-center gap-3">
              <input
                type="number"
                min="0"
                value={score?.homeScore ?? ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateScore(fixture.id, 'homeScore', parseScoreValue(event.target.value))}
                className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-2xl font-black text-white outline-none transition focus:border-yellow-300/60 focus:bg-yellow-300/10 focus:ring-2 focus:ring-yellow-300/25 sm:h-16 sm:w-20 sm:text-3xl"
              />

              <span className="font-black text-slate-500">:</span>

              <input
                type="number"
                min="0"
                value={score?.awayScore ?? ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateScore(fixture.id, 'awayScore', parseScoreValue(event.target.value))}
                className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-2xl font-black text-white outline-none transition focus:border-yellow-300/60 focus:bg-yellow-300/10 focus:ring-2 focus:ring-yellow-300/25 sm:h-16 sm:w-20 sm:text-3xl"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Actual</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                {statusLabel && (
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${statusPillClass}`}>
                    {statusLabel}
                  </span>
                )}
                <p className="text-base font-black text-white sm:text-lg">{actualScoreLabel}</p>
              </div>
              {actualScoreDetail && <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{actualScoreDetail}</p>}
            </div>
          </div>

          <div className="min-w-0 text-right">
            <div className="mb-2 flex justify-end">
              <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="lg" />
            </div>
            <p className="truncate text-base font-black text-white sm:text-lg">{awayTeam?.name ?? fixture.awayTeamId}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {awayTeam?.shortName ?? 'Away'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <p className="rounded-full bg-slate-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-100 sm:text-xs">
            {formatLocalFixtureDateTime(fixture)}
          </p>
          <p>{fixture.venue}</p>
        </div>

        {hasEspnData && !isCompleted && !hideLoadRealDataButton && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLoadRealData}
              disabled={isLoadRealDataDisabled}
              className="rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
            >
              {copyingRealData || realMatchLoading ? 'Loading real data...' : 'Load real data'}
            </button>
            {loadRealDataStatus === 'copied' && <span className="text-xs font-black text-emerald-300">Actual score copied.</span>}
            {loadRealDataStatus === 'unavailable' && <span className="text-xs font-black text-yellow-200">Actual score unavailable.</span>}
            {loadRealDataStatus === 'error' && <span className="text-xs font-black text-red-200">Unable to copy score.</span>}
          </div>
        )}
      </article>

      <RealMatchModal
        fixture={fixture}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
