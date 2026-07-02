import { useEffect, useMemo, useState } from 'react'
import { MatchScoreCard } from '../../components/groups/MatchScoreCard'
import { RealMatchModal } from '../../components/matches/RealMatchModal'
import { TeamFlag } from '../../components/ui/TeamFlag'
import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import {
  getKnockoutFixture,
  getTeamFromQualifiedRow,
  knockoutStageLabels
} from '../../logic/knockoutFixtures'
import { getFinalMatch, getQuarterFinalMatches, getSemiFinalMatches, getThirdPlaceMatch } from '../../logic/finalRounds'
import { getRoundOf16Matches } from '../../logic/roundOf16'
import { getRoundOf32Matches } from '../../logic/roundOf32'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { formatLocalFixtureDateTime, getFixtureKickoffDate } from '../../utils/fixtureTime'
import type { RealMatchData } from '../../types/realMatch'
import type { Fixture, PredictionScore, ResolvedKnockoutMatch, Team } from '../../types/tournament'

const MATCH_LIVE_LOOKUP_WINDOW_MS = 3 * 60 * 60 * 1000

type DashboardFixtureEntry = {
  fixture: Fixture
  homeTeam?: Team
  awayTeam?: Team
  source: 'group' | 'knockout'
  match?: ResolvedKnockoutMatch
}

function isFixtureScoreCompleted(
  fixtureId: string,
  scores: ReturnType<typeof usePredictionStore.getState>['scores']
) {
  const score = scores[fixtureId]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

function getFixtureSlotKey(fixture: Fixture) {
  const normalizedTimeSlot = fixture.kickoffTimeSort || fixture.kickoffTime

  if (fixture.date && normalizedTimeSlot) {
    return `${fixture.date}|${normalizedTimeSlot}`
  }

  const kickoffDate = getFixtureKickoffDate(fixture)

  return kickoffDate ? String(kickoffDate.getTime()) : null
}

function getDatedFixtureEntries(entries: DashboardFixtureEntry[]) {
  return entries
    .map((entry) => ({ entry, kickoffDate: getFixtureKickoffDate(entry.fixture) }))
    .filter(
      (item): item is { entry: DashboardFixtureEntry; kickoffDate: Date } =>
        item.kickoffDate instanceof Date
    )
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())
}

function getNextFixtureEntry(entries: DashboardFixtureEntry[]) {
  const now = Date.now()
  const datedEntries = getDatedFixtureEntries(entries)

  return datedEntries.find((entry) => entry.kickoffDate.getTime() >= now)?.entry ?? null
}

function getEntriesInSameSlot(entries: DashboardFixtureEntry[], selectedEntry: DashboardFixtureEntry | null) {
  if (!selectedEntry) {
    return []
  }

  const selectedSlotKey = getFixtureSlotKey(selectedEntry.fixture)

  if (!selectedSlotKey) {
    return [selectedEntry]
  }

  const matchingEntries = entries.filter((entry) => getFixtureSlotKey(entry.fixture) === selectedSlotKey)
  const sortedEntries = getDatedFixtureEntries(matchingEntries).map((entry) => entry.entry)

  return sortedEntries.length ? sortedEntries : matchingEntries
}

function getRealMatchStatusText(realMatch?: RealMatchData) {
  return `${realMatch?.status.short ?? ''} ${realMatch?.status.long ?? ''}`.toLowerCase()
}

function isCompletedRealMatch(realMatch?: RealMatchData) {
  const status = getRealMatchStatusText(realMatch)

  return (
    status.includes('ft') ||
    status.includes('full time') ||
    status.includes('full-time') ||
    status.includes('final') ||
    status.includes('postponed') ||
    status.includes('abandoned')
  )
}

function isLiveRealMatch(realMatch?: RealMatchData) {
  if (!realMatch || isCompletedRealMatch(realMatch)) {
    return false
  }

  const status = getRealMatchStatusText(realMatch)

  return (
    status.includes('live') ||
    status.includes('half') ||
    status.includes('break') ||
    status.includes('progress') ||
    status.includes('in play') ||
    status.includes('1st') ||
    status.includes('2nd') ||
    status.includes('first') ||
    status.includes('second') ||
    typeof realMatch.status.elapsed === 'number'
  )
}

function isLikelyLiveFixture(fixture: Fixture, realMatch?: RealMatchData) {
  if (realMatch && isCompletedRealMatch(realMatch)) {
    return false
  }

  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!kickoffDate) {
    return false
  }

  const elapsedSinceKickoff = Date.now() - kickoffDate.getTime()

  return elapsedSinceKickoff >= 0 && elapsedSinceKickoff <= MATCH_LIVE_LOOKUP_WINDOW_MS
}

function formatCountdownTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`

  return `${seconds}s`
}

function getStatusLabel(realMatch?: RealMatchData) {
  if (!realMatch) return null

  if (isLiveRealMatch(realMatch) && typeof realMatch.status.elapsed === 'number') {
    const shortLabel = realMatch.status.short && !/^live$/i.test(realMatch.status.short) ? realMatch.status.short : null
    return shortLabel || `LIVE ${realMatch.status.elapsed}'`
  }

  return realMatch.status.short || realMatch.status.long || null
}

function getCountdownLabel(fixture: Fixture, now: number, realMatch?: RealMatchData) {
  const kickoffDate = getFixtureKickoffDate(fixture)

  if (!kickoffDate) return null

  const millisecondsToKickoff = kickoffDate.getTime() - now

  if (millisecondsToKickoff <= 0) {
    if (realMatch && !isCompletedRealMatch(realMatch)) {
      return getStatusLabel(realMatch) || 'Match in progress'
    }

    return 'Match started'
  }

  return `Kickoff in ${formatCountdownTime(millisecondsToKickoff)}`
}

function getGroupStageEntries(fixtures: Fixture[], teams: Team[]): DashboardFixtureEntry[] {
  return fixtures
    .filter((fixture) => fixture.stage === 'group')
    .map((fixture) => ({
      fixture,
      homeTeam: teams.find((team) => team.id === fixture.homeTeamId),
      awayTeam: teams.find((team) => team.id === fixture.awayTeamId),
      source: 'group' as const
    }))
}

function getResolvedKnockoutEntries(matches: ResolvedKnockoutMatch[]): DashboardFixtureEntry[] {
  return matches.flatMap((match) => {
    const fixture = getKnockoutFixture(match)

    if (!fixture) return []

    return [
      {
        fixture,
        homeTeam: getTeamFromQualifiedRow(match.homeTeam),
        awayTeam: getTeamFromQualifiedRow(match.awayTeam),
        source: 'knockout' as const,
        match
      }
    ]
  })
}

function getKnockoutEntries(scores: Record<string, PredictionScore>, data: ReturnType<typeof useTournamentData>) {
  const roundOf32 = getRoundOf32Matches(scores, data)
  const roundOf16 = getRoundOf16Matches(scores)
  const quarterFinals = getQuarterFinalMatches(scores)
  const semiFinals = getSemiFinalMatches(scores)
  const thirdPlace = getThirdPlaceMatch(scores)
  const final = getFinalMatch(scores)

  return getResolvedKnockoutEntries([
    ...roundOf32,
    ...roundOf16,
    ...quarterFinals,
    ...semiFinals,
    ...thirdPlace,
    ...final
  ])
}

function FeaturedKnockoutCard({
  entry,
  highlighted,
  showCountdown
}: {
  entry: DashboardFixtureEntry
  highlighted?: boolean
  showCountdown?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const realMatch = useRealMatchStore((state) => state.matches[entry.fixture.id])
  const statusLabel = getStatusLabel(realMatch)
  const countdownLabel = showCountdown ? getCountdownLabel(entry.fixture, currentTime, realMatch) : null

  useEffect(() => {
    if (!showCountdown) return

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    setCurrentTime(Date.now())

    return () => {
      window.clearInterval(timer)
    }
  }, [showCountdown])

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setModalOpen(true)
          }
        }}
        className={`cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-lg transition hover:-translate-y-0.5 ${
          highlighted
            ? 'live-golden-shadow border-yellow-200/70 bg-yellow-300/15 ring-4 ring-yellow-300/40'
            : 'border-white/10 bg-slate-950/45 hover:border-yellow-300/25 hover:bg-white/8'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-200 ring-1 ring-yellow-300/20">
              Match {entry.fixture.matchNumber}
            </span>
            {entry.match && (
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
                {knockoutStageLabels[entry.match.stage]}
              </span>
            )}
            {statusLabel && (
              <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-100">
                {statusLabel}
              </span>
            )}
          </div>

          {countdownLabel && (
            <span className="w-full rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-yellow-100 sm:w-auto sm:py-1 sm:text-xs sm:tracking-[0.14em]">
              {countdownLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="min-w-0 text-left">
            <div className="mb-2 flex justify-start">
              <TeamFlag code={entry.homeTeam?.flagCode} label={entry.homeTeam?.name} size="lg" />
            </div>
            <p className="truncate text-base font-black text-white sm:text-lg">
              {entry.homeTeam?.name ?? entry.fixture.homeTeamId}
            </p>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {entry.homeTeam?.shortName ?? 'Home'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Actual</p>
            <p className="mt-1 whitespace-nowrap text-lg font-black text-white sm:text-2xl">
              {realMatch?.score.display ?? '-'}
            </p>
            {realMatch?.penaltyShootout?.display && (
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                Pens {realMatch.penaltyShootout.display}
              </p>
            )}
          </div>

          <div className="min-w-0 text-right">
            <div className="mb-2 flex justify-end">
              <TeamFlag code={entry.awayTeam?.flagCode} label={entry.awayTeam?.name} size="lg" />
            </div>
            <p className="truncate text-base font-black text-white sm:text-lg">
              {entry.awayTeam?.name ?? entry.fixture.awayTeamId}
            </p>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {entry.awayTeam?.shortName ?? 'Away'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs font-bold text-slate-400 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="rounded-full bg-slate-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-100 sm:text-xs">
            {formatLocalFixtureDateTime(entry.fixture)}
          </p>
          <p className="text-white sm:text-right">{entry.fixture.venue}, {entry.fixture.city}</p>
        </div>
      </article>

      <RealMatchModal
        fixture={entry.fixture}
        homeTeam={entry.homeTeam}
        awayTeam={entry.awayTeam}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}

export function DashboardPage() {
  const scores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { teams, groups, fixtures } = useTournamentData()

  const completedMatches = fixtures.filter((fixture) => isFixtureScoreCompleted(fixture.id, scores)).length
  const effectiveScores = useMemo(
    () => getScoresWithRealMatchData(scores, realMatches),
    [realMatches, scores]
  )
  const groupStageEntries = useMemo(
    () => getGroupStageEntries(fixtures, teams),
    [fixtures, teams]
  )
  const knockoutEntries = useMemo(
    () => getKnockoutEntries(effectiveScores, { groups, teams, fixtures }),
    [effectiveScores, fixtures, groups, teams]
  )
  const scheduledEntries = useMemo(
    () => [...groupStageEntries, ...knockoutEntries],
    [groupStageEntries, knockoutEntries]
  )
  const nextEntry = useMemo(() => getNextFixtureEntry(scheduledEntries), [scheduledEntries])
  const nextFixtureSlot = useMemo(
    () => getEntriesInSameSlot(scheduledEntries, nextEntry),
    [scheduledEntries, nextEntry]
  )

  const liveEntries = useMemo(
    () =>
      scheduledEntries.filter(
        (entry) =>
          isLiveRealMatch(realMatches[entry.fixture.id]) ||
          isLikelyLiveFixture(entry.fixture, realMatches[entry.fixture.id])
      ),
    [realMatches, scheduledEntries]
  )

  useEffect(() => {
    if (liveEntries.length === 0) {
      return undefined
    }

    function fetchLiveMatches() {
      const latestState = useRealMatchStore.getState()

      liveEntries.forEach((entry) => {
        const fixture = entry.fixture
        const latestRealMatch = latestState.matches[fixture.id]

        if (latestState.loading[fixture.id]) {
          return
        }

        if (
          latestRealMatch &&
          !isLiveRealMatch(latestRealMatch) &&
          !isLikelyLiveFixture(fixture, latestRealMatch)
        ) {
          return
        }

        void latestState.fetchMatchData(fixture, true, { silent: true })
      })
    }

    fetchLiveMatches()

    const intervalId = window.setInterval(fetchLiveMatches, 1000)

    return () => window.clearInterval(intervalId)
  }, [liveEntries])

  const featuredEntries = liveEntries.length > 0 ? liveEntries : nextFixtureSlot
  const hasMultipleLiveFixtures = liveEntries.length > 1
  const hasMultipleScheduledFixtures = liveEntries.length === 0 && featuredEntries.length > 1

  return (
    <div className="grid gap-5 sm:gap-6">
      <section id="dashboard" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Teams loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{teams.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">All World Cup teams are ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Groups loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{groups.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Group A to Group L are ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Fixtures loaded</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{fixtures.length}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Full group-stage fixture data is ready.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-xl sm:rounded-3xl sm:p-5">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">Scores entered</p>
          <p className="mt-2 text-3xl font-black text-white sm:text-4xl">{completedMatches}</p>
          <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm">Scores save to your account after login.</p>
        </article>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:rounded-4xl sm:p-5">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300 sm:text-sm sm:tracking-[0.3em]">
            {liveEntries.length > 0 ? 'Live now' : hasMultipleScheduledFixtures ? 'Next match slot' : 'Next match'}
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white">
            {hasMultipleLiveFixtures
              ? 'Live matches centre'
              : liveEntries.length === 1
                ? 'Live match centre'
                : hasMultipleScheduledFixtures
                  ? 'Upcoming fixtures'
                  : 'Upcoming fixture'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {hasMultipleLiveFixtures
              ? 'Multiple ESPN matches are currently in progress. Open each card for live score, timeline and match details.'
              : liveEntries.length === 1
                ? 'An ESPN match is currently in progress. Open the card for live score, timeline and match details.'
                : hasMultipleScheduledFixtures
                  ? 'Multiple fixtures share the next scheduled kickoff slot, so they are shown together with live kickoff countdowns.'
                  : 'No unfinished live ESPN match is currently loaded. The next scheduled fixture is shown below with a live kickoff countdown.'}
          </p>
        </div>

        {featuredEntries.length > 0 ? (
          <div className={featuredEntries.length > 1 ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-3'}>
            {featuredEntries.map((entry) => {
              const isLiveFixture = liveEntries.some((liveEntry) => liveEntry.fixture.id === entry.fixture.id)

              if (entry.source === 'knockout') {
                return (
                  <FeaturedKnockoutCard
                    key={entry.fixture.id}
                    entry={entry}
                    highlighted={isLiveFixture}
                    showCountdown
                  />
                )
              }

              return (
                <MatchScoreCard
                  key={entry.fixture.id}
                  fixture={entry.fixture}
                  homeTeam={entry.homeTeam}
                  awayTeam={entry.awayTeam}
                  highlighted={isLiveFixture}
                  showCountdown
                  hideLoadRealDataButton
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm font-bold text-slate-300">
            No fixture is available to feature yet.
          </div>
        )}
      </section>
    </div>
  )
}
