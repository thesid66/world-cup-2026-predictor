import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canFetchEspnWorldCupMatchData, fetchEspnWorldCupMatchDataForFixture } from '../services/espnWorldCup'
import type { RealMatchData } from '../types/realMatch'
import type { Fixture } from '../types/tournament'

const REAL_MATCH_CACHE_TTL_MS = 60 * 1000

type RealMatchState = {
  matches: Record<string, RealMatchData>
  loading: Record<string, boolean>
  errors: Record<string, string | null>
  fetchMatchData: (fixture: Fixture, force?: boolean) => Promise<void>
  clearRealMatchCache: () => void
}

function isRealMatchCacheFresh(matchData: RealMatchData) {
  const fetchedAtTime = Date.parse(matchData.fetchedAt)

  if (Number.isNaN(fetchedAtTime)) {
    return false
  }

  return Date.now() - fetchedAtTime < REAL_MATCH_CACHE_TTL_MS
}

export const useRealMatchStore = create<RealMatchState>()(
  persist(
    (set, get) => ({
      matches: {},
      loading: {},
      errors: {},

      fetchMatchData: async (fixture, force = false) => {
        if (!canFetchEspnWorldCupMatchData(fixture)) {
          set((state) => ({
            errors: {
              ...state.errors,
              [fixture.id]: 'ESPN World Cup data is not available for this fixture yet.'
            }
          }))
          return
        }

        const existing = get().matches[fixture.id]

        if (existing && !force && isRealMatchCacheFresh(existing)) {
          return
        }

        set((state) => ({
          loading: { ...state.loading, [fixture.id]: true },
          errors: { ...state.errors, [fixture.id]: null }
        }))

        try {
          const data = await fetchEspnWorldCupMatchDataForFixture(fixture)

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
    { name: 'world-cup-2026-real-match-cache-v3' }
  )
)
