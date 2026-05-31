import { useState } from 'react'
import type { Fixture, Team } from '../../types/tournament'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { formatNepalFixtureDateTime } from '../../utils/fixtureTime'
import { RealMatchModal } from '../matches/RealMatchModal'
import { TeamFlag } from '../ui/TeamFlag'
import { apiFootballFixtureIdMap } from '../../data/apiFootballFixtureIds'

type MatchScoreCardProps = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
}

function parseScoreValue(value: string): number | null {
  if (value === '') return null

  const parsed = Number(value)

  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

export function MatchScoreCard({ fixture, homeTeam, awayTeam }: MatchScoreCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const score = usePredictionStore((state) => state.scores[fixture.id])
  const updateScore = usePredictionStore((state) => state.updateScore)

  const realMatch = useRealMatchStore((state) => state.matches[fixture.id])
  const realMatchLoading = useRealMatchStore((state) => state.loading[fixture.id])

  const isCompleted = typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'

  const hasApiFixtureId =
    Boolean(fixture.apiFootballFixtureId) || Boolean(apiFootballFixtureIdMap[fixture.id])

  const actualScoreLabel = realMatch
    ? realMatch.score.display
    : hasApiFixtureId
      ? realMatchLoading
        ? 'Loading...'
        : 'Not loaded'
      : 'Not linked'

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setModalOpen(true)
          }
        }}
        className={`group cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-lg transition hover:-translate-y-0.5 ${
          isCompleted
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

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isCompleted
                ? 'bg-emerald-300/15 text-emerald-200 ring-1 ring-emerald-300/25'
                : 'bg-white/8 text-slate-400'
            }`}
          >
            {isCompleted ? 'Predicted' : 'Pending'}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="lg" />

            <div className="min-w-0">
              <p className="truncate font-black text-white">{homeTeam?.name}</p>
              <p className="text-xs font-bold text-slate-500">{homeTeam?.shortName}</p>
            </div>
          </div>

          <div
            className="rounded-2xl border border-white/10 bg-black/20 p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={score?.homeScore ?? ''}
                onChange={(event) =>
                  updateScore(fixture.id, 'homeScore', parseScoreValue(event.target.value))
                }
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10"
              />

              <span className="font-black text-slate-500">:</span>

              <input
                type="number"
                min={0}
                value={score?.awayScore ?? ''}
                onChange={(event) =>
                  updateScore(fixture.id, 'awayScore', parseScoreValue(event.target.value))
                }
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

          <div className="flex min-w-0 items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <p className="truncate font-black text-white">{awayTeam?.name}</p>
              <p className="text-xs font-bold text-slate-500">{awayTeam?.shortName}</p>
            </div>

            <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="lg" />
          </div>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-8 sm:mt-6 sm:pt-5">
          <span className="absolute left-3 right-3 top-0 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-yellow-200 shadow-lg sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:whitespace-nowrap sm:text-[10px] sm:tracking-[0.18em]">
            {formatNepalFixtureDateTime(fixture)} NPT
          </span>
          <p className="text-xs font-bold text-slate-500">
            {fixture.venue}, {fixture.city}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
            Click for real data
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
