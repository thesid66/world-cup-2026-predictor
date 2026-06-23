import { useEffect, useMemo } from 'react'
import type { Fixture, QualifiedTeamRow, ResolvedKnockoutMatch } from '../../types/tournament'
import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { getFixtureKickoffDate } from '../../utils/fixtureTime'
import { TeamFlag } from '../ui/TeamFlag'

type KnockoutMatchCardProps = {
  match: ResolvedKnockoutMatch
}

type KnockoutFixtureMetadata = Pick<
  Fixture,
  'date' | 'kickoffTime' | 'kickoffTimeSort' | 'venue' | 'city'
>

type UsableActualScore = {
  home: number
  away: number
}

const stageLabels: Record<ResolvedKnockoutMatch['stage'], string> = {
  round32: 'Round of 32',
  round16: 'Round of 16',
  quarterFinal: 'Quarter-final',
  semiFinal: 'Semi-final',
  thirdPlace: 'Third-place match',
  final: 'Final'
}

const knockoutFixtureMetadataByMatchNumber: Record<number, KnockoutFixtureMetadata> = {
  73: {
    date: '2026-06-28',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  74: {
    date: '2026-06-29',
    kickoffTime: '4:30 PM ET',
    kickoffTimeSort: '16:30',
    venue: 'Gillette Stadium',
    city: 'Foxborough'
  },
  75: {
    date: '2026-06-29',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Estadio BBVA',
    city: 'Guadalupe'
  },
  76: {
    date: '2026-06-29',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'NRG Stadium',
    city: 'Houston'
  },
  77: {
    date: '2026-06-30',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  },
  78: {
    date: '2026-06-30',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  79: {
    date: '2026-06-30',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Estadio Azteca',
    city: 'Mexico City'
  },
  80: {
    date: '2026-07-01',
    kickoffTime: '12:00 PM ET',
    kickoffTimeSort: '12:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  81: {
    date: '2026-07-01',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: "Levi's Stadium",
    city: 'Santa Clara'
  },
  82: {
    date: '2026-07-01',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'Lumen Field',
    city: 'Seattle'
  },
  83: {
    date: '2026-07-02',
    kickoffTime: '7:00 PM ET',
    kickoffTimeSort: '19:00',
    venue: 'BMO Field',
    city: 'Toronto'
  },
  84: {
    date: '2026-07-02',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  85: {
    date: '2026-07-02',
    kickoffTime: '11:00 PM ET',
    kickoffTimeSort: '23:00',
    venue: 'BC Place',
    city: 'Vancouver'
  },
  86: {
    date: '2026-07-03',
    kickoffTime: '6:00 PM ET',
    kickoffTimeSort: '18:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  87: {
    date: '2026-07-03',
    kickoffTime: '9:30 PM ET',
    kickoffTimeSort: '21:30',
    venue: 'Arrowhead Stadium',
    city: 'Kansas City'
  },
  88: {
    date: '2026-07-03',
    kickoffTime: '2:00 PM ET',
    kickoffTimeSort: '14:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  89: {
    date: '2026-07-04',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Lincoln Financial Field',
    city: 'Philadelphia'
  },
  90: {
    date: '2026-07-04',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'NRG Stadium',
    city: 'Houston'
  },
  91: {
    date: '2026-07-05',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  },
  92: {
    date: '2026-07-05',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: 'Estadio Azteca',
    city: 'Mexico City'
  },
  93: {
    date: '2026-07-06',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  94: {
    date: '2026-07-06',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: 'Lumen Field',
    city: 'Seattle'
  },
  95: {
    date: '2026-07-07',
    kickoffTime: '12:00 PM ET',
    kickoffTimeSort: '12:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  96: {
    date: '2026-07-07',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'BC Place',
    city: 'Vancouver'
  },
  97: {
    date: '2026-07-09',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'Gillette Stadium',
    city: 'Foxborough'
  },
  98: {
    date: '2026-07-10',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  99: {
    date: '2026-07-11',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  100: {
    date: '2026-07-11',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Arrowhead Stadium',
    city: 'Kansas City'
  },
  101: {
    date: '2026-07-14',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  102: {
    date: '2026-07-15',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  103: {
    date: '2026-07-18',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  104: {
    date: '2026-07-19',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  }
}

function parseScoreValue(value: string): number | null {
  if (value === '') return null

  const parsed = Number(value)

  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function hasUsableActualScore(score?: {
  home: number | null
  away: number | null
}): score is UsableActualScore {
  return typeof score?.home === 'number' && typeof score.away === 'number'
}

function getKnockoutFixture(match: ResolvedKnockoutMatch): Fixture | null {
  const metadata = knockoutFixtureMetadataByMatchNumber[match.matchNumber]

  if (!metadata || !match.homeTeam || !match.awayTeam) {
    return null
  }

  return {
    id: match.id,
    matchNumber: match.matchNumber,
    stage: 'group',
    ...metadata,
    homeTeamId: match.homeTeam.teamId,
    awayTeamId: match.awayTeam.teamId
  }
}

function getTeamSeedDescription(team: QualifiedTeamRow) {
  const status = team.isGroupComplete ? 'Qualified' : 'Qualified · provisional slot'

  return `${team.seedLabel} · ${team.shortName} · ${status}`
}

function QualifiedPill({ provisional }: { provisional: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ring-1 ${
        provisional
          ? 'bg-sky-300/10 text-sky-100 ring-sky-300/25'
          : 'bg-emerald-300/15 text-emerald-100 ring-emerald-300/30'
      }`}
    >
      {provisional ? 'Q · provisional' : 'Q'}
    </span>
  )
}

function TeamSide({
  team,
  fallbackLabel,
  align = 'left'
}: {
  team?: QualifiedTeamRow
  fallbackLabel: string
  align?: 'left' | 'right'
}) {
  const provisional = Boolean(team && !team.isGroupComplete)

  return (
    <div
      className={`flex min-w-0 items-center gap-2 sm:gap-3 ${
        align === 'right' ? 'justify-end text-right' : ''
      }`}
    >
      {align === 'left' && <TeamFlag code={team?.flagCode} label={team?.teamName} size="lg" />}

      <div className="min-w-0">
        <div className={`flex flex-wrap items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
          <p className="break-words text-sm font-black leading-tight text-white sm:truncate sm:text-base">
            {team ? team.teamName : fallbackLabel}
          </p>

          {team && <QualifiedPill provisional={provisional} />}
        </div>

        <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">
          {team ? getTeamSeedDescription(team) : 'Pending'}
        </p>
      </div>

      {align === 'right' && <TeamFlag code={team?.flagCode} label={team?.teamName} size="lg" />}
    </div>
  )
}

export function KnockoutMatchCard({ match }: KnockoutMatchCardProps) {
  const score = usePredictionStore((state) => state.scores[match.id])
  const updateScore = usePredictionStore((state) => state.updateScore)
  const setWinnerTeam = usePredictionStore((state) => state.setWinnerTeam)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)

  const hasBothTeams = Boolean(match.homeTeam && match.awayTeam)
  const hasAnyScore = typeof score?.homeScore === 'number' || typeof score?.awayScore === 'number'
  const hasBothScores = typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  const isDraw = hasBothScores && score?.homeScore === score?.awayScore && hasBothTeams

  const knockoutFixture = useMemo(
    () => getKnockoutFixture(match),
    [match.id, match.matchNumber, match.homeTeam?.teamId, match.awayTeam?.teamId]
  )

  const winner = getKnockoutMatchWinner({
    match,
    score
  })

  useEffect(() => {
    if (!knockoutFixture || hasAnyScore) return

    const kickoffDate = getFixtureKickoffDate(knockoutFixture)

    if (kickoffDate && kickoffDate.getTime() > Date.now()) return

    let cancelled = false

    async function loadRealScore() {
      await fetchMatchData(knockoutFixture, false, { silent: true })

      if (cancelled) return

      const latestScore = useRealMatchStore.getState().matches[knockoutFixture.id]?.score

      if (!hasUsableActualScore(latestScore)) return

      const currentScore = usePredictionStore.getState().scores[match.id]
      const hasCurrentScore =
        typeof currentScore?.homeScore === 'number' || typeof currentScore?.awayScore === 'number'

      if (hasCurrentScore) return

      updateScore(match.id, 'homeScore', latestScore.home)
      updateScore(match.id, 'awayScore', latestScore.away)
    }

    void loadRealScore()

    return () => {
      cancelled = true
    }
  }, [fetchMatchData, hasAnyScore, knockoutFixture, match.id, updateScore])

  return (
    <article
      className={`group overflow-hidden rounded-2xl border p-3 shadow-lg transition hover:-translate-y-0.5 sm:p-4 ${
        winner
          ? 'border-emerald-300/25 bg-emerald-300/10'
          : hasBothTeams
            ? 'border-white/10 bg-slate-950/45 hover:border-yellow-300/25 hover:bg-white/8'
            : 'border-white/10 bg-slate-950/35 opacity-90'
      }`}
    >
      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              winner
                ? 'bg-emerald-300 text-emerald-950'
                : 'bg-yellow-300/10 text-yellow-200 ring-1 ring-yellow-300/20'
            }`}
          >
            Match {match.matchNumber}
          </span>

          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-400">
            {stageLabels[match.stage]}
          </span>
        </div>

        {winner && (
          <span className="w-full rounded-full bg-emerald-300/15 px-3 py-2 text-center text-xs font-black text-emerald-200 ring-1 ring-emerald-300/25 sm:w-auto sm:py-1">
            {winner.shortName} advance
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <TeamSide team={match.homeTeam} fallbackLabel={match.homeLabel} />

        <div className="col-span-2 row-start-2 mx-auto w-full max-w-[18rem] rounded-2xl border border-white/10 bg-black/20 p-2 sm:col-span-1 sm:row-start-auto sm:w-auto sm:max-w-none">
          <div className="flex items-center justify-center gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              disabled={!hasBothTeams}
              value={score?.homeScore ?? ''}
              onChange={(event) =>
                updateScore(match.id, 'homeScore', parseScoreValue(event.target.value))
              }
              className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-40"
            />

            <span className="font-black text-slate-500">:</span>

            <input
              type="number"
              min={0}
              inputMode="numeric"
              disabled={!hasBothTeams}
              value={score?.awayScore ?? ''}
              onChange={(event) =>
                updateScore(match.id, 'awayScore', parseScoreValue(event.target.value))
              }
              className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
        </div>

        <div className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
          <TeamSide team={match.awayTeam} fallbackLabel={match.awayLabel} align="right" />
        </div>
      </div>

      <div className="relative mt-8 border-t border-white/10 pt-8 sm:mt-6 sm:pt-5">
        <span className="absolute left-2 right-2 top-0 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-center text-[8px] font-black uppercase tracking-[0.08em] text-yellow-200 shadow-lg sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:whitespace-nowrap sm:text-[10px] sm:tracking-[0.18em]">
          Knockout fixture
        </span>

        {!hasBothTeams && (
          <p className="rounded-xl bg-yellow-300/10 px-3 py-3 text-center text-xs font-bold leading-5 text-yellow-100 sm:text-left">
            Complete or mathematically resolve the previous stage to resolve this match.
          </p>
        )}

        {isDraw && match.homeTeam && match.awayTeam && (
          <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 p-3">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-yellow-200 sm:tracking-[0.2em]">
              Draw after score — select advancing team
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {[match.homeTeam, match.awayTeam].map((team) => {
                const isSelected = score?.winnerTeamId === team.teamId

                return (
                  <button
                    key={team.teamId}
                    type="button"
                    onClick={() => setWinnerTeam(match.id, team.teamId)}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition ${
                      isSelected
                        ? 'bg-emerald-300 text-emerald-950'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    <TeamFlag code={team.flagCode} label={team.teamName} />
                    {team.teamName}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
