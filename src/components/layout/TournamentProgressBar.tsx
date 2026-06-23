import { Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { useRealMatchStore } from '../../store/realMatchStore'
import { usePredictionStore } from '../../store/predictionStore'
import type { PredictionScore } from '../../types/tournament'

const TOTAL_TOURNAMENT_MATCHES = 104
const TOURNAMENT_MATCH_ID_PATTERN = /^match-(\d{3})$/

function hasCompletedScore(score: PredictionScore | undefined) {
  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function getTournamentMatchNumber(fixtureId: string) {
  const match = fixtureId.match(TOURNAMENT_MATCH_ID_PATTERN)

  if (!match) {
    return null
  }

  const matchNumber = Number.parseInt(match[1], 10)

  return matchNumber >= 1 && matchNumber <= TOTAL_TOURNAMENT_MATCHES ? matchNumber : null
}

function getStageLabel(completedMatches: number) {
  if (completedMatches >= 104) return 'Tournament complete'
  if (completedMatches >= 103) return 'Final weekend'
  if (completedMatches >= 101) return 'Semi-finals'
  if (completedMatches >= 97) return 'Quarter-finals'
  if (completedMatches >= 89) return 'Round of 16'
  if (completedMatches >= 73) return 'Round of 32'
  if (completedMatches > 0) return 'Group stage'

  return 'Tournament not started'
}

export function TournamentProgressBar() {
  const scores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)

  const progress = useMemo(() => {
    const effectiveScores = getScoresWithRealMatchData(scores, realMatches)
    const completedMatchNumbers = new Set<number>()

    Object.entries(effectiveScores).forEach(([fixtureId, score]) => {
      const matchNumber = getTournamentMatchNumber(fixtureId)

      if (matchNumber && hasCompletedScore(score)) {
        completedMatchNumbers.add(matchNumber)
      }
    })

    const completedMatches = completedMatchNumbers.size
    const percentage = Math.min(
      100,
      Math.max(0, Math.round((completedMatches / TOTAL_TOURNAMENT_MATCHES) * 100))
    )

    return {
      completedMatches,
      percentage,
      stageLabel: getStageLabel(completedMatches)
    }
  }, [realMatches, scores])

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-slate-950/90 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:px-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[104rem] items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-950/20 sm:flex">
            <Trophy className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.68rem] font-black uppercase tracking-[0.22em] text-yellow-200 sm:text-xs">
                  Tournament progress
                </p>
                <p className="truncate text-xs font-bold text-slate-300 sm:text-sm">
                  {progress.stageLabel}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-white sm:text-base">{progress.percentage}%</p>
                <p className="hidden text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                  {progress.completedMatches}/{TOTAL_TOURNAMENT_MATCHES} matches
                </p>
              </div>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
              aria-label={`Tournament progress: ${progress.completedMatches} of ${TOTAL_TOURNAMENT_MATCHES} matches completed`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={TOTAL_TOURNAMENT_MATCHES}
              aria-valuenow={progress.completedMatches}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-emerald-300 to-sky-300 transition-[width] duration-500 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
