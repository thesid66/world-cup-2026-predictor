import { RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { Fixture, Team } from '../../types/tournament'
import type { RealMatchStatistic } from '../../types/realMatch'
import { canFetchSportScoreMatchData } from '../../services/sportScore'
import { TeamFlag } from '../ui/TeamFlag'

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

function normalizeStatLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getStatValue(stats: RealMatchStatistic[], type: string) {
  const normalizedType = normalizeStatLabel(type)
  const item = stats.find((stat) => normalizeStatLabel(stat.type) === normalizedType)

  return item?.value ?? '-'
}

function getAvailableStatTypes(homeStats: RealMatchStatistic[], awayStats: RealMatchStatistic[]) {
  const availableTypes = [...homeStats, ...awayStats]
    .map((stat) => stat.type)
    .filter(Boolean)

  const uniqueTypes = Array.from(new Set(availableTypes))
  const uniqueTypeKeys = new Set(uniqueTypes.map(normalizeStatLabel))

  const matchedFeaturedStats = featuredStats.filter((type) => uniqueTypeKeys.has(normalizeStatLabel(type)))
  const featuredKeys = new Set(matchedFeaturedStats.map(normalizeStatLabel))
  const extraStats = uniqueTypes.filter((type) => !featuredKeys.has(normalizeStatLabel(type)))

  return [...matchedFeaturedStats, ...extraStats]
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
  const availableStatTypes = getAvailableStatTypes(homeStats, awayStats)
  const hasSportScoreData = canFetchSportScoreMatchData(fixture)

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <article
        className="max-h-[94svh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-300">
                SportScore match data
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="min-w-0 text-center sm:flex sm:items-center sm:gap-3 sm:text-left">
                <div className="mb-2 flex justify-center sm:mb-0">
                  <TeamFlag code={homeTeam?.flagCode} label={homeTeam?.name} size="md" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white sm:text-lg">
                    {homeTeam?.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {homeTeam?.shortName}
                  </p>
                </div>
              </div>

              <div className="flex min-w-[92px] flex-col items-center rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-3 text-center sm:min-w-[150px] sm:px-6 sm:py-4">
                <p className="w-full text-center text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200 sm:text-xs sm:tracking-[0.2em]">
                  Actual
                </p>

                <p className="mt-1 w-full whitespace-nowrap text-center text-2xl font-black text-white sm:text-4xl">
                  {matchData?.score.display ?? '- - -'}
                </p>

                <p className="mx-auto mt-1 w-full max-w-[88px] truncate text-center text-[10px] font-bold text-slate-400 sm:max-w-none sm:text-xs">
                  {matchData?.status.long ?? 'Not loaded'}
                </p>
              </div>

              <div className="min-w-0 text-center sm:flex sm:items-center sm:justify-end sm:gap-3 sm:text-right">
                <div className="mb-2 flex justify-center sm:order-2 sm:mb-0">
                  <TeamFlag code={awayTeam?.flagCode} label={awayTeam?.name} size="md" />
                </div>

                <div className="min-w-0 sm:order-1">
                  <p className="truncate text-xs font-black text-white sm:text-lg">
                    {awayTeam?.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {awayTeam?.shortName}
                  </p>
                </div>
              </div>
            </div>

            {!hasSportScoreData && (
              <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                <p className="text-sm font-bold leading-6 text-yellow-100">
                  SportScore data is not available for this fixture yet.
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
                  Loading SportScore data...
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

            {availableStatTypes.length ? (
              <div className="grid gap-3">
                {availableStatTypes.map((statType) => (
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
                Statistics will appear here when SportScore has data for this fixture.
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
