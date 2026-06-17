import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canFetchSportScoreMatchData, fetchSportScoreMatchDataForFixture } from '../services/sportScore'
import type { RealMatchData } from '../types/realMatch'
import type { Fixture } from '../types/tournament'

type RealMatchState = {
  matches: Record<string, RealMatchData>
  loading: Record<string, boolean>
  errors: Record<string, string | null>
  fetchMatchData: (fixture: Fixture, force?: boolean) => Promise<void>
  clearRealMatchCache: () => void
}

export const useRealMatchStore = create<RealMatchState>()(
  persist(
    (set, get) => ({
      matches: {},
      loading: {},
      errors: {},

      fetchMatchData: async (fixture, force = false) => {
        if (!canFetchSportScoreMatchData(fixture)) {
          set((state) => ({
            errors: {
              ...state.errors,
              [fixture.id]: 'SportScore data is not available for this fixture yet.'
            }
          }))
          return
        }

        const existing = get().matches[fixture.id]

        if (existing && !force) {
          return
        }

        set((state) => ({
          loading: { ...state.loading, [fixture.id]: true },
          errors: { ...state.errors, [fixture.id]: null }
        }))

        try {
          const data = await fetchSportScoreMatchDataForFixture(fixture)

          set((state) => ({
            matches: { ...state.matches, [fixture.id]: data },
            loading: { ...state.loading, [fixture.id]: false },
            errors: { ...state.errors, [fixture.id]: null }
          }))
        } catch (error) {
          set((state) => ({
            loading: { ...state.loading, [fixture.id]: false },
            errors: {
              ...state.errors,
              [fixture.id]: error instanceof Error ? error.message : 'Unable to load real match data.'
            }
          }))
        }
      },

      clearRealMatchCache: () => {
        set({ matches: {}, loading: {}, errors: {} })
      }
    }),
    { name: 'world-cup-2026-real-match-cache' }
  )
)
