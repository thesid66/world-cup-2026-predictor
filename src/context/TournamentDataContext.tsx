import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadTournamentData, type TournamentData } from '../services/tournamentDataService'

type TournamentDataContextValue = TournamentData & {
  loading: boolean
}

const TournamentDataContext = createContext<TournamentDataContextValue | null>(null)

type TournamentDataProviderProps = {
  children: ReactNode
}

export function TournamentDataProvider({ children }: TournamentDataProviderProps) {
  const [data, setData] = useState<TournamentData | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      const tournamentData = await loadTournamentData()

      if (isMounted) {
        setData(tournamentData)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo<TournamentDataContextValue | null>(() => {
    if (!data) {
      return null
    }

    return {
      ...data,
      loading: false
    }
  }, [data])

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-white">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-sky-300">Loading</p>
          <h1 className="mt-3 text-3xl font-black">Preparing tournament data...</h1>
          <p className="mt-2 text-sm text-slate-400">
            Loading database data first. Local fallback remains available.
          </p>
        </div>
      </div>
    )
  }

  return <TournamentDataContext.Provider value={value}>{children}</TournamentDataContext.Provider>
}

export function useTournamentData() {
  const context = useContext(TournamentDataContext)

  if (!context) {
    throw new Error('useTournamentData must be used inside TournamentDataProvider')
  }

  return context
}
