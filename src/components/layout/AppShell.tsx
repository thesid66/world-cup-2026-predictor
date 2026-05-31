import { CalendarDays, GitBranch, Medal, Table2, Trophy } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
}

const navItems = [
  {
    label: 'Dashboard',
    href: '#dashboard',
    icon: Trophy
  },
  {
    label: 'Predictions',
    href: '#predictions',
    icon: CalendarDays
  },
  {
    label: 'Standings',
    href: '#standings',
    icon: Table2
  },
  {
    label: 'Knockout',
    href: '#knockout',
    icon: GitBranch
  },
  {
    label: 'Champion',
    href: '#champion',
    icon: Medal
  }
]

export function AppShell({ children }: AppShellProps) {
  const [showBottomNav, setShowBottomNav] = useState(false)

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
    <main className="min-h-screen px-4 py-5 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-black uppercase tracking-[0.35em] text-yellow-300">
                Local Predictor
              </p>

              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                World Cup 2026 Predictor
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Predict every score manually, build the group tables, rank the best third-placed
                teams, and complete your road to the final.
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 px-5 py-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-200">Mode</p>
              <p className="mt-1 text-lg font-black text-white">Offline Local</p>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-slate-200 transition hover:-translate-y-0.5 hover:border-yellow-300/40 hover:bg-yellow-300/10 hover:text-white"
                >
                  <Icon className="size-4 text-yellow-300 transition group-hover:scale-110" />
                  {item.label}
                </a>
              )
            })}
          </nav>
        </header>

        {children}
      </div>

      <div
        className={`fixed inset-x-0 bottom-4 z-50 px-3 transition-all duration-300 ease-out sm:bottom-6 ${
          showBottomNav
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-8 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-fit items-center gap-1 rounded-full border border-white/15 bg-slate-950/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-white/10">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className="group flex h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-black text-slate-300 transition hover:-translate-y-0.5 hover:bg-yellow-300 hover:text-slate-950 sm:px-4"
              >
                <Icon className="size-5 text-yellow-300 transition group-hover:text-slate-950" />

                <span className="hidden sm:inline">{item.label}</span>
              </a>
            )
          })}
        </nav>
      </div>
    </main>
  )
}
