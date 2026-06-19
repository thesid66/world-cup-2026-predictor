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

function getCountdownLabel(fixture: Fixture, now: number) {
  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!kickoffDate) return null

  const millisecondsToKickoff = kickoffDate.getTime() - now

  if (millisecondsToKickoff <= 0) return 'Kickoff reached'

  return `Kickoff in ${formatCountdownTime(millisecondsToKickoff)}`
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
  showCountdown = false
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
  const countdownLabel = showCountdown ? getCountdownLabel(fixture, currentTime) : null
  const statusLabel = getStatusLabel(realMatch?.status)
  const statusDetail = getStatusDetail(realMatch?.status)
  const statusPillClass = getStatusPillClass(realMatch?.status)

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
            ? 'border-yellow-200/70 bg-yellow-300/15 ring-4 ring-yellow-300/40'
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

        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="lg" />

            <div className="min-w-0">
              <p className="break-words text-sm font-black leading-tight text-white sm:truncate sm:text-base">
                {homeTeam?.name}
              </p>
              <p className="text-[11px] font-bold text-slate-500 sm:text-xs">{homeTeam?.shortName}</p>
            </div>
          </div>

          <div
            className="col-span-2 row-start-2 mx-auto w-full max-w-[18rem] rounded-2xl border border-white/10 bg-black/20 p-2 sm:col-span-1 sm:row-start-auto sm:w-auto sm:max-w-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={score?.homeScore ?? ''}
                onChange={(event) => {
                  setLoadRealDataStatus('idle')
                  updateScore(fixture.id, 'homeScore', parseScoreValue(event.target.value))
                }}
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 sm:h-12 sm:w-14"
              />

              <span className="font-black text-slate-500">:</span>

              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={score?.awayScore ?? ''}
                onChange={(event) => {
                  setLoadRealDataStatus('idle')
                  updateScore(fixture.id, 'awayScore', parseScoreValue(event.target.value))
                }}
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 sm:h-12 sm:w-14"
              />
            </div>

            <div className="mt-2 rounded-xl border border-sky-300/15 bg-sky-300/10 px-3 py-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">
                Actual
              </p>
              {statusLabel && (
                <p className={`mx-auto mt-1 w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusPillClass}`}>
                  {statusLabel}
                </p>
              )}
              <p className="mt-1 text-sm font-black text-white">{actualScoreLabel}</p>
              {actualScoreDetail && <p className="mt-0.5 text-[10px] font-bold text-slate-400">{actualScoreDetail}</p>}
            </div>
          </div>

          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 text-right sm:col-start-auto sm:row-start-auto sm:gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-black leading-tight text-white sm:truncate sm:text-base">
                {awayTeam?.name}
              </p>
              <p className="text-[11px] font-bold text-slate-500 sm:text-xs">{awayTeam?.shortName}</p>
            </div>

            <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="lg" />
          </div>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-end">
          <span className="text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500 sm:text-left sm:text-sm sm:tracking-[0.2em]">
            {formatLocalFixtureDateTime(fixture)}
          </span>

          <p className="text-center text-xs font-bold leading-5 text-slate-500 sm:text-left">
            {fixture.venue}, {fixture.city}
          </p>

          <div className="flex flex-col items-stretch gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled={isLoadRealDataDisabled}
              onClick={handleLoadRealData}
              className="min-h-10 rounded-full border border-emerald-300/30 bg-emerald-300/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100 shadow-lg shadow-emerald-950/20 transition hover:border-emerald-200 hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500 sm:tracking-[0.16em]"
            >
              {copyingRealData || realMatchLoading
                ? 'Loading real data...'
                : hasEspnData
                  ? 'Load real data'
                  : 'Real data unavailable'}
            </button>

            {loadRealDataStatus !== 'idle' && (
              <p
                className={`text-center text-[10px] font-bold ${
                  loadRealDataStatus === 'copied'
                    ? 'text-emerald-200'
                    : loadRealDataStatus === 'unavailable'
                      ? 'text-yellow-200'
                      : 'text-red-200'
                }`}
              >
                {loadRealDataStatus === 'copied'
                  ? 'Score replaced with actual result.'
                  : loadRealDataStatus === 'unavailable'
                    ? 'Actual score is not available yet.'
                    : 'Could not load real data.'}
              </p>
            )}
          </div>

          <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 sm:text-right sm:text-xs sm:tracking-[0.2em]">
            Click for ESPN match data
          </p>
        </div>
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
