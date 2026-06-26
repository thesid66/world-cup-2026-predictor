import { useEffect, useState } from 'react'
import { AppShell, type AppPage } from '../components/layout/AppShell'
import { GroupStageSection } from '../components/groups/GroupStageSection'
import { AuthModal } from '../components/auth/AuthModal'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { PredictionSyncProvider } from '../context/PredictionSyncContext'
import { TournamentDataProvider } from '../context/TournamentDataContext'
import { GoogleAnalytics } from '../components/analytics/GoogleAnalytics'
import { DashboardPage } from './pages/DashboardPage'
import { StandingsPage } from './pages/StandingsPage'
import { KnockoutPage } from './pages/KnockoutPage'
import { CountryPage } from './pages/CountryPage'

const pageHashes: Record<AppPage, string> = {
  dashboard: 'dashboard',
  fixtures: 'fixtures',
  standings: 'standings',
  knockout: 'knockout',
  countries: 'countries'
}

function getPageFromHash(): AppPage {
  const hash = window.location.hash.replace(/^#/, '')
  const match = (Object.entries(pageHashes) as Array<[AppPage, string]>).find(
    ([, pageHash]) => pageHash === hash
  )

  return match?.[0] ?? 'dashboard'
}

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const [activePage, setActivePage] = useState<AppPage>(() => getPageFromHash())
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalDismissed, setAuthModalDismissed] = useState(false)

  useEffect(() => {
    function handleHashChange() {
      setActivePage(getPageFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

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

  function handlePageChange(page: AppPage) {
    setActivePage(page)
    window.history.replaceState(null, '', `#${pageHashes[page]}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <GoogleAnalytics />

      <AppShell
        activePage={activePage}
        onPageChange={handlePageChange}
        onAuthClick={() => {
          setAuthModalDismissed(false)
          setAuthModalOpen(true)
        }}
      >
        {activePage === 'dashboard' && <DashboardPage />}
        {activePage === 'fixtures' && <GroupStageSection />}
        {activePage === 'standings' && <StandingsPage />}
        {activePage === 'knockout' && <KnockoutPage />}
        {activePage === 'countries' && <CountryPage />}
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
