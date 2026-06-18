import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { GroupStageSection } from '../components/groups/GroupStageSection'
import { usePredictionStore } from '../store/predictionStore'
import { ThirdPlaceRanking } from '../components/groups/ThirdPlaceRanking'
import { RoundOf32QualifiedTeams } from '../components/knockout/RoundOf32QualifiedTeams'
import { RoundOf32Bracket } from '../components/knockout/RoundOf32Bracket'
import { GroupStandingsSection } from '../components/groups/GroupStandingsSection'
import { RoundOf16Bracket } from '../components/knockout/RoundOf16Bracket'
import { FinalRounds } from '../components/knockout/FinalRounds'
import { AuthModal } from '../components/auth/AuthModal'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { PredictionSyncProvider } from '../context/PredictionSyncContext'
import { TournamentDataProvider, useTournamentData } from '../context/TournamentDataContext'
import { GoogleAnalytics } from '../components/analytics/GoogleAnalytics'

function AppContent() {
  const scores = usePredictionStore((state) => state.scores)
  const { teams, groups, fixtures } = useTournamentData()
  const { user, loading: authLoading } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalDismissed, setAuthModalDismissed] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !authModalDismissed) {
      setAuthModalOpen(true)
    }
  }, [authLoading, authModalDismissed, user])

  useEffect(() => {
    if (user) {
      setAuthModalOpen(false)
      setAuthModalDismissed(false)
    }
  }, [user])

  const completedMatches = fixtures.filter((fixture) => {
    const score = scores[fixture.id]
    return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  }).length

  return (
    <>
      <GoogleAnalytics />

      <AppShell
        onAuthClick={() => {
          setAuthModalDismissed(false)
          setAuthModalOpen(true)
        }}
      >
        <section id="dashboard" className="scroll-mt-6 grid gap-5 lg:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm font-bold text-slate-400">Teams loaded</p>
            <p className="mt-2 text-4xl font-black text-white">{teams.length}</p>
            <p className="mt-2 text-sm text-slate-300">All World Cup teams are ready.</p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm font-bold text-slate-400">Groups loaded</p>
            <p className="mt-2 text-4xl font-black text-white">{groups.length}</p>
            <p className="mt-2 text-sm text-slate-300">Group A to Group L are ready.</p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm font-bold text-slate-400">Fixtures loaded</p>
            <p className="mt-2 text-4xl font-black text-white">{fixtures.length}</p>
            <p className="mt-2 text-sm text-slate-300">Full group-stage fixture data is ready.</p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm font-bold text-slate-400">Predicted matches</p>
            <p className="mt-2 text-4xl font-black text-white">{completedMatches}</p>
            <p className="mt-2 text-sm text-slate-300">Scores save to your account after login.</p>
          </article>
        </section>

        <GroupStageSection />
        <GroupStandingsSection />
        <ThirdPlaceRanking />
        <RoundOf32QualifiedTeams />
        <RoundOf32Bracket />
        <RoundOf16Bracket />
        <FinalRounds />
      </AppShell>

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false)
          setAuthModalDismissed(true)
        }}
      />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <TournamentDataProvider>
        <PredictionSyncProvider>
          <AppContent />
        </PredictionSyncProvider>
      </TournamentDataProvider>
    </AuthProvider>
  )
}
