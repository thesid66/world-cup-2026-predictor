import { useEffect, useMemo } from 'react'
import { useTournamentData } from '../../context/TournamentDataContext'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { Fixture } from '../../types/tournament'
import { MatchScoreCard } from './MatchScoreCard'

const REAL_MATCH_PRELOAD_BATCH_SIZE = 6

function isFixtureCompleted(
  fixture: Fixture,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function sortFixturesByDateAndTime(a: Fixture, b: Fixture) {
  const dateCompare = a.date.localeCompare(b.date)

  if (dateCompare !== 0) {
    return dateCompare
  }

  const aSortTime = a.kickoffTimeSort ?? ''
  const bSortTime = b.kickoffTimeSort ?? ''

  if (aSortTime && bSortTime) {
    const timeCompare = aSortTime.localeCompare(bSortTime)

    if (timeCompare !== 0) {
      return timeCompare
    }
  }

  return a.matchNumber - b.matchNumber
}

export function GroupStageSection() {
  const scores = usePredictionStore((state) => state.scores)
  const resetPredictions = usePredictionStore((state) => state.resetPredictions)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)
  const { fixtures, teams } = useTournamentData()

  const groupStageFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.stage === 'group').sort(sortFixturesByDateAndTime),
    [fixtures]
  )

  useEffect(() => {
    let cancelled = false

    async function preloadRealMatchData() {
      for (let index = 0; index < groupStageFixtures.length; index += REAL_MATCH_PRELOAD_BATCH_SIZE) {
        if (cancelled) {
          return
        }

        const batch = groupStageFixtures.slice(index, index + REAL_MATCH_PRELOAD_BATCH_SIZE)

        await Promise.all(batch.map((fixture) => fetchMatchData(fixture)))
      }
    }

    void preloadRealMatchData()

    return () => {
      cancelled = true
    }
  }, [fetchMatchData, groupStageFixtures])

  const completedMatches = groupStageFixtures.filter((fixture) =>
    isFixtureCompleted(fixture, scores)
  ).length

  const totalMatches = groupStageFixtures.length
  const progress = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

  return (
    <section id="predictions" className="mt-6 scroll-mt-6">
      <div className="mb-6 overflow-hidden rounded-4xl border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-linear-to-r from-yellow-300/10 via-sky-400/10 to-emerald-300/10" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-300">
                Group stage
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Fixture-by-fixture predictor
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Predict the tournament in match order. Scores update group standings, third-place
                ranking and knockout qualification automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={resetPredictions}
              className="rounded-2xl border border-red-300/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:-translate-y-0.5 hover:bg-red-400/20"
            >
              Reset all scores
            </button>
          </div>

          <div className="relative mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                <span>Overall group-stage progress</span>
                <span>{progress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-yellow-300 via-sky-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Predicted
              </p>

              <p className="mt-1 text-3xl font-black text-white">
                {completedMatches}/{totalMatches}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-4xl border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">
              Match flow
            </p>

            <h3 className="mt-1 text-2xl font-black text-white">All group-stage fixtures</h3>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">
            Sorted by date and time
          </span>
        </div>

        <div className="grid gap-4">
          {groupStageFixtures.map((fixture) => {
            const homeTeam = teams.find((team) => team.id === fixture.homeTeamId)
            const awayTeam = teams.find((team) => team.id === fixture.awayTeamId)

            return (
              <MatchScoreCard
                key={fixture.id}
                fixture={fixture}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
