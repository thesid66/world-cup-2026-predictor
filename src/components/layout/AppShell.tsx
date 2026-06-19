import { CalendarDays, GitBranch, LogIn, LogOut, Table2, Trophy } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'

export type AppPage = 'dashboard' | 'fixtures' | 'standings' | 'knockout'

type AppShellProps = {
  children: ReactNode
  activePage: AppPage
  onPageChange: (page: AppPage) => void
  onAuthClick?: () => void
}

const navItems: Array<{
  label: string
  page: AppPage
  icon: typeof Trophy
}> = [
  {
    label: 'Dashboard',
    page: 'dashboard',
    icon: Trophy
  },
  {
    label: 'Fixtures',
    page: 'fixtures',
    icon: CalendarDays
  },
  {
    label: 'Standings',
    page: 'standings',
    icon: Table2
  },
  {
    label: 'Knockout & Finals',
    page: 'knockout',
    icon: GitBranch
  }
]

export function AppShell({ children, activePage, onPageChange, onAuthClick }: AppShellProps) {
  const [showBottomNav, setShowBottomNav] = useState(false)
  const { user, signOut } = useAuth()

  useEffect(() => {
    function handleScroll() {
      setShowBottomNav(window.scrollY > 150)
    }

    handleScroll()

    window.addEventListener('scroll', handleScroll, {
      passive: true
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <main className="min-h-screen px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto w-full max-w-[104rem]">
        <header className="mb-5 rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:mb-8 sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-yellow-300 sm:text-sm sm:tracking-[0.35em]">
                Tournament Hub
              </p>

              <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                World Cup 2026 Hub
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Track every fixture, load real scores, build the group tables, rank the best
                third-placed teams, and complete your road to the final.
              </p>
            </div>

            <div className="w-full rounded-2xl border border-yellow-300/25 bg-yellow-300/10 px-4 py-4 text-center sm:w-auto sm:min-w-64 sm:px-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-200">Mode</p>
              <p className="mt-1 text-lg font-black text-white">
                {user ? 'Cloud saved' : 'Sign in required'}
              </p>
              <p className="mx-auto mt-1 max-w-full truncate text-xs font-bold text-slate-300 sm:max-w-52">
                {user?.email ?? 'Progress saves after login'}
              </p>

              {user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-slate-100 transition hover:bg-white/15 sm:w-auto"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAuthClick}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-yellow-200 sm:w-auto"
                >
                  <LogIn className="size-4" />
                  Sign in / Register
                </button>
              )}
            </div>
          </div>

          <nav className="mt-5 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.page

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onPageChange(item.page)}
                  className={`group flex min-h-11 shrink-0 snap-start items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 lg:min-w-0 ${
                    isActive
                      ? 'border-yellow-300/50 bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-950/20'
                      : 'border-white/10 bg-white/8 text-slate-200 hover:border-yellow-300/40 hover:bg-yellow-300/10 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`size-4 transition group-hover:scale-110 ${
                      isActive ? 'text-slate-950' : 'text-yellow-300'
                    }`}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </header>

        <div className="grid gap-5 sm:gap-6">{children}</div>
      </div>

      <div
        className={`fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 px-3 transition-all duration-300 ease-out sm:bottom-6 ${
          showBottomNav
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-8 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-slate-950/85 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-white/10 sm:max-w-fit sm:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.page

            return (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                title={item.label}
                onClick={() => onPageChange(item.page)}
                className={`group flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-black transition hover:-translate-y-0.5 sm:px-4 ${
                  isActive
                    ? 'bg-yellow-300 text-slate-950'
                    : 'text-slate-300 hover:bg-yellow-300 hover:text-slate-950'
                }`}
              >
                <Icon
                  className={`size-5 transition ${
                    isActive ? 'text-slate-950' : 'text-yellow-300 group-hover:text-slate-950'
                  }`}
                />

                <span className="hidden whitespace-nowrap sm:inline">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </main>
  )
}
