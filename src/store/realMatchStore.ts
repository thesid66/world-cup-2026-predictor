import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFootballFixtureIdMap } from '../data/apiFootballFixtureIds'
import { fetchApiFootballMatchData } from '../services/apiFootball'
import type { RealMatchData } from '../types/realMatch'
import type { Fixture } from '../types/tournament'

function getApiFootballFixtureId(fixture: Fixture) {
  return fixture.apiFootballFixtureId ?? apiFootballFixtureIdMap[fixture.id]
}

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
        const apiFixtureId = getApiFootballFixtureId(fixture)

        if (!apiFixtureId) {
          set((state) => ({
            errors: {
              ...state.errors,
              [fixture.id]: 'This fixture is not linked to an API-Football fixture ID yet.'
            }
          }))

          return
        }

        const existing = get().matches[fixture.id]

        if (existing && !force) {
          return
        }

        set((state) => ({
          loading: {
            ...state.loading,
            [fixture.id]: true
          },
          errors: {
            ...state.errors,
            [fixture.id]: null
          }
        }))

        try {
          const data = await fetchApiFootballMatchData(apiFixtureId)

          set((state) => ({
            matches: {
              ...state.matches,
              [fixture.id]: data
            },
            loading: {
              ...state.loading,
              [fixture.id]: false
            },
            errors: {
              ...state.errors,
              [fixture.id]: null
            }
          }))
        } catch (error) {
          set((state) => ({
            loading: {
              ...state.loading,
              [fixture.id]: false
            },
            errors: {
              ...state.errors,
              [fixture.id]:
                error instanceof Error ? error.message : 'Unable to load real match data.'
            }
          }))
        }
      },

      clearRealMatchCache: () => {
        set({
          matches: {},
          loading: {},
          errors: {}
        })
      }
    }),
    {
      name: 'world-cup-2026-real-match-cache'
    }
  )
)
