import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PredictionScore } from '../types/tournament'

type PredictionState = {
  scores: Record<string, PredictionScore>
  updateScore: (fixtureId: string, field: 'homeScore' | 'awayScore', value: number | null) => void
  setWinnerTeam: (fixtureId: string, winnerTeamId: string) => void
  resetPredictions: () => void
}

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set) => ({
      scores: {},

      updateScore: (fixtureId, field, value) => {
        set((state) => {
          const existingScore = state.scores[fixtureId] ?? {
            homeScore: null,
            awayScore: null
          }

          const nextScore: PredictionScore = {
            ...existingScore,
            [field]: value
          }

          const hasBothScores =
            typeof nextScore.homeScore === 'number' && typeof nextScore.awayScore === 'number'

          if (!hasBothScores || nextScore.homeScore !== nextScore.awayScore) {
            delete nextScore.winnerTeamId
          }

          return {
            scores: {
              ...state.scores,
              [fixtureId]: nextScore
            }
          }
        })
      },

      setWinnerTeam: (fixtureId, winnerTeamId) => {
        set((state) => {
          const existingScore = state.scores[fixtureId] ?? {
            homeScore: null,
            awayScore: null
          }

          return {
            scores: {
              ...state.scores,
              [fixtureId]: {
                ...existingScore,
                winnerTeamId
              }
            }
          }
        })
      },

      resetPredictions: () => {
        set({ scores: {} })
      }
    }),
    {
      name: 'world-cup-2026-predictions'
    }
  )
)
