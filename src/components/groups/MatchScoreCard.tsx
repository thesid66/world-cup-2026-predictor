import { useState, type MouseEvent } from 'react'
import type { Fixture, Team } from '../../types/tournament'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { formatNepalFixtureDateTime } from '../../utils/fixtureTime'
import { canFetchSportScoreMatchData } from '../../services/sportScore'
import { RealMatchModal } from '../matches/RealMatchModal'
import { TeamFlag } from '../ui/TeamFlag'

type MatchScoreCardProps = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
  domId?: string
  highlighted?: boolean
}

type LoadRealDataStatus = 'idle' | 'copied' | 'unavailable' | 'error'

type UsableActualScore = {
  home: number
  away: number
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

export function MatchScoreCard({
  fixture,
  homeTeam,
  awayTeam,
  domId,
  highlighted = false
}: MatchScoreCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loadRealDataStatus, setLoadRealDataStatus] = useState<LoadRealDataStatus>('idle')
  const [copyingRealData, setCopyingRealData] = useState(false)

  const score = usePredictionStore((state) => state.scores[fixture.id])
  const updateScore = usePredictionStore((state) => state.updateScore)

  const realMatch = useRealMatchStore((state) => state.matches[fixture.id])
  const realMatchLoading = useRealMatchStore((state) => state.loading[fixture.id])
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)

  const isCompleted = typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  const hasSportScoreData = canFetchSportScoreMatchData(fixture)
  const isLoadRealDataDisabled = !hasSportScoreData || realMatchLoading || copyingRealData

  const actualScoreLabel = realMatch
    ? realMatch.score.display
    : hasSportScoreData
      ? realMatchLoading
        ? 'Loading...'
        : 'Not loaded'
      : 'Not linked'

  async function handleLoadRealData(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()

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

  return (
    <>
      <article
        id={domId}
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setModalOpen(true)
          }
        }}
        className={`group scroll-mt-28 cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-lg transition hover:-translate-y-0.5 ${
          highlighted
            ? 'border-yellow-200/70 bg-yellow-300/15 ring-4 ring-yellow-300/40'
            : isCompleted
              ? 'border-emerald-300/25 bg-emerald-300/10'
              : 'border-white/10 bg-slate-950/45 hover:border-yellow-300/25 hover:bg-white/8'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

            <span className="text-xs font-bold text-slate-500">{fixture.city}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="lg" />

            <div className="min-w-0">
              <p className="break-words text-sm font-black leading-tight text-white sm:truncate sm:text-base">
                {homeTeam?.name}
              </p>
              <p className="text-xs font-bold text-slate-500">{homeTeam?.shortName}</p>
            </div>
          </div>

          <div
            className="col-span-2 row-start-2 mx-auto w-full max-w-[16rem] rounded-2xl border border-white/10 bg-black/20 p-2 sm:col-span-1 sm:row-start-auto sm:w-auto sm:max-w-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min={0}
                value={score?.homeScore ?? ''}
                onChange={(event) => {
                  setLoadRealDataStatus('idle')
                  updateScore(fixture.id, 'homeScore', parseScoreValue(event.target.value))
                }}
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10"
              />

              <span className="font-black text-slate-500">:</span>

              <input
                type="number"
                min={0}
                value={score?.awayScore ?? ''}
                onChange={(event) => {
                  setLoadRealDataStatus('idle')
                  updateScore(fixture.id, 'awayScore', parseScoreValue(event.target.value))
                }}
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10"
              />
            </div>

            <div className="mt-2 rounded-xl border border-sky-300/15 bg-sky-300/10 px-3 py-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">
                Actual
              </p>
              <p className="mt-0.5 text-sm font-black text-white">{actualScoreLabel}</p>
            </div>
          </div>

          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-3 text-right sm:col-start-auto sm:row-start-auto">
            <div className="min-w-0">
              <p className="break-words text-sm font-black leading-tight text-white sm:truncate sm:text-base">
                {awayTeam?.name}
              </p>
              <p className="text-xs font-bold text-slate-500">{awayTeam?.shortName}</p>
            </div>

            <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="lg" />
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 border-t border-white/10 pt-8 sm:mt-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:pt-5">
          <span className="absolute left-3 right-3 top-0 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-yellow-200 shadow-lg sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:whitespace-nowrap sm:text-[10px] sm:tracking-[0.18em]">
            {formatNepalFixtureDateTime(fixture)} NPT
          </span>

          <p className="text-xs font-bold text-slate-500">
            {fixture.venue}, {fixture.city}
          </p>

          <div className="flex flex-col items-stretch gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled={isLoadRealDataDisabled}
              onClick={handleLoadRealData}
              className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 shadow-lg shadow-emerald-950/20 transition hover:border-emerald-200 hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
            >
              {copyingRealData || realMatchLoading
                ? 'Loading real data...'
                : hasSportScoreData
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

          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 sm:text-right">
            Click for SportScore data
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
