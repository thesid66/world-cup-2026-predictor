import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { usePredictionStore } from '../store/predictionStore'
import {
  loadAndMigrateUserPredictions,
  savePredictionScores
} from '../services/predictionCloudService'

export type PredictionSyncStatus =
  | 'disabled'
  | 'signed-out'
  | 'loading'
  | 'migrating'
  | 'synced'
  | 'saving'
  | 'error'

type PredictionSyncContextValue = {
  status: PredictionSyncStatus
  message: string
  predictionSetId: string | null
  cloudReady: boolean
}

const PredictionSyncContext = createContext<PredictionSyncContextValue | null>(null)

const SAVE_DEBOUNCE_MS = 700

function getStatusMessage(status: PredictionSyncStatus) {
  switch (status) {
    case 'disabled':
      return 'Cloud save is unavailable because Supabase is not configured.'
    case 'signed-out':
      return 'Sign in to save predictions to your account.'
    case 'loading':
      return 'Loading your saved predictions...'
    case 'migrating':
      return 'Copying your existing local predictions to your account...'
    case 'saving':
      return 'Saving predictions to your account...'
    case 'error':
      return 'Cloud sync failed. Your local browser copy is still safe.'
    case 'synced':
    default:
      return 'Predictions are saved to your account.'
  }
}

type PredictionSyncProviderProps = {
  children: ReactNode
}

export function PredictionSyncProvider({ children }: PredictionSyncProviderProps) {
  const { user, loading: authLoading, isConfigured } = useAuth()
  const scores = usePredictionStore((state) => state.scores)
  const replaceScores = usePredictionStore((state) => state.replaceScores)

  const [status, setStatus] = useState<PredictionSyncStatus>('loading')
  const [predictionSetId, setPredictionSetId] = useState<string | null>(null)
  const [cloudReady, setCloudReady] = useState(false)

  const skipNextSaveRef = useRef(false)
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isConfigured) {
      setStatus('disabled')
      setCloudReady(false)
      setPredictionSetId(null)
      return
    }

    if (authLoading) {
      setStatus('loading')
      return
    }

    if (!user) {
      if (previousUserIdRef.current) {
        skipNextSaveRef.current = true
        replaceScores({})
      }

      previousUserIdRef.current = null
      setStatus('signed-out')
      setCloudReady(false)
      setPredictionSetId(null)
      return
    }

    let cancelled = false

    async function loadUserPredictions() {
      try {
        const localScores = usePredictionStore.getState().scores
        const hasLocalScores = Object.keys(localScores).length > 0

        setStatus(hasLocalScores ? 'migrating' : 'loading')
        setCloudReady(false)
        skipNextSaveRef.current = true

        const result = await loadAndMigrateUserPredictions(user.id, user.email, localScores)

        if (cancelled) return

        previousUserIdRef.current = user.id
        setPredictionSetId(result.predictionSetId)
        replaceScores(result.scores)
        setCloudReady(true)
        setStatus('synced')

        window.setTimeout(() => {
          skipNextSaveRef.current = false
        }, 0)
      } catch (error) {
        if (cancelled) return

        console.error(error)
        setStatus('error')
        setCloudReady(false)
      }
    }

    void loadUserPredictions()

    return () => {
      cancelled = true
    }
  }, [authLoading, isConfigured, replaceScores, user])

  useEffect(() => {
    if (!user || !predictionSetId || !cloudReady) {
      return
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    setStatus('saving')

    const timer = window.setTimeout(() => {
      savePredictionScores(predictionSetId, user.id, scores)
        .then(() => {
          setStatus('synced')
        })
        .catch((error) => {
          console.error(error)
          setStatus('error')
        })
    }, SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [cloudReady, predictionSetId, scores, user])

  const value = useMemo<PredictionSyncContextValue>(
    () => ({
      status,
      message: getStatusMessage(status),
      predictionSetId,
      cloudReady
    }),
    [cloudReady, predictionSetId, status]
  )

  return <PredictionSyncContext.Provider value={value}>{children}</PredictionSyncContext.Provider>
}

export function usePredictionSync() {
  const context = useContext(PredictionSyncContext)

  if (!context) {
    throw new Error('usePredictionSync must be used inside PredictionSyncProvider')
  }

  return context
}
