import { RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { Fixture, Team } from '../../types/tournament'
import type { RealMatchStatistic } from '../../types/realMatch'
import { TeamFlag } from '../ui/TeamFlag'
import { apiFootballFixtureIdMap } from '../../data/apiFootballFixtureIds'

type RealMatchModalProps = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
  open: boolean
  onClose: () => void
}

const featuredStats = [
  'Ball Possession',
  'Total Shots',
  'Shots on Goal',
  'Corner Kicks',
  'Fouls',
  'Yellow Cards',
  'Red Cards'
]

function getStatValue(stats: RealMatchStatistic[], type: string) {
  const item = stats.find((stat) => stat.type === type)

  return item?.value ?? '-'
}

export function RealMatchModal({
  fixture,
  homeTeam,
  awayTeam,
  open,
  onClose
}: RealMatchModalProps) {
  const matchData = useRealMatchStore((state) => state.matches[fixture.id])
  const loading = useRealMatchStore((state) => state.loading[fixture.id])
  const error = useRealMatchStore((state) => state.errors[fixture.id])
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)

  useEffect(() => {
    if (open) {
      void fetchMatchData(fixture)
    }
  }, [fetchMatchData, fixture, open])

  if (!open) {
    return null
  }

  const homeStats = matchData?.statistics[0]?.statistics ?? []
  const awayStats = matchData?.statistics[1]?.statistics ?? []

  const hasApiFixtureId =
    Boolean(fixture.apiFootballFixtureId) || Boolean(apiFootballFixtureIdMap[fixture.id])

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <article
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-4xl border border-white/10 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-300">
                Real match data
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">Match {fixture.matchNumber}</h2>

              <p className="mt-1 text-sm font-bold text-slate-500">
                {fixture.venue}, {fixture.city}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchMatchData(fixture, true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/15"
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-slate-300 transition hover:bg-red-400/15 hover:text-red-200"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-5">
          <section className="rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex items-center gap-3">
                <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="lg" />

                <div>
                  <p className="text-lg font-black text-white">{homeTeam?.name}</p>
                  <p className="text-xs font-bold text-slate-500">{homeTeam?.shortName}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-6 py-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-200">
                  Actual
                </p>
                <p className="mt-1 text-4xl font-black text-white">
                  {matchData?.score.display ?? '- - -'}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {matchData?.status.long ?? 'Not loaded'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 text-right">
                <div>
                  <p className="text-lg font-black text-white">{awayTeam?.name}</p>
                  <p className="text-xs font-bold text-slate-500">{awayTeam?.shortName}</p>
                </div>

                <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="lg" />
              </div>
            </div>

            {!hasApiFixtureId && (
              <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-yellow-100">
                  This match is not linked to an API-Football fixture ID yet. Once we add{' '}
                  <code className="font-black">apiFootballFixtureId</code> in{' '}
                  <code className="font-black">fixtures.ts</code>, real score and stats will load
                  here.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-red-100">{error}</p>
              </div>
            )}

            {loading && (
              <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-sky-100">
                  Loading real match data...
                </p>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Match statistics
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Team comparison</h3>
            </div>

            {matchData?.statistics.length ? (
              <div className="grid gap-3">
                {featuredStats.map((statType) => (
                  <div
                    key={statType}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                  >
                    <p className="text-right text-sm font-black text-white">
                      {getStatValue(homeStats, statType)}
                    </p>

                    <p className="min-w-40 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      {statType}
                    </p>

                    <p className="text-sm font-black text-white">
                      {getStatValue(awayStats, statType)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                Statistics will appear here when the API has data for this fixture.
              </p>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Events
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Match timeline</h3>
            </div>

            {matchData?.events.length ? (
              <div className="grid gap-3">
                {matchData.events.map((event, index) => (
                  <div
                    key={`${event.elapsed}-${event.playerName}-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-black text-white">
                        {event.elapsed}
                        {event.extra ? `+${event.extra}` : ''}' · {event.type}
                      </p>

                      <p className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
                        {event.teamName}
                      </p>
                    </div>

                    <p className="mt-2 text-sm font-bold text-slate-400">
                      {event.playerName}
                      {event.assistName ? ` · Assist: ${event.assistName}` : ''}
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-500">{event.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-950/45 p-4 text-sm font-bold text-slate-400">
                Goals, cards and substitutions will appear here when available.
              </p>
            )}
          </section>
        </div>
      </article>
    </div>,
    document.body
  )
}
