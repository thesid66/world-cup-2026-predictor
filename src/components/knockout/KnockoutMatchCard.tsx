import { useEffect, useMemo, useState } from 'react'
import type { PredictionScore, QualifiedTeamRow, ResolvedKnockoutMatch } from '../../types/tournament'
import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import {
  getKnockoutFixture,
  getTeamFromQualifiedRow,
  knockoutStageLabels
} from '../../logic/knockoutFixtures'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { formatLocalFixtureDateTime, getFixtureKickoffDate } from '../../utils/fixtureTime'
import { RealMatchModal } from '../matches/RealMatchModal'
import { TeamFlag } from '../ui/TeamFlag'

type KnockoutMatchCardProps = {
  match: ResolvedKnockoutMatch
}

type UsableActualScore = {
  home: number
  away: number
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

function getTeamSeedDescription(team: QualifiedTeamRow) {
  const status = team.isGroupComplete ? 'Qualified' : 'Qualified · provisional slot'

  return `${team.seedLabel} · ${team.shortName} · ${status}`
}

function getEffectiveScore(score: PredictionScore | undefined, realScore?: UsableActualScore, winnerTeamId?: string): PredictionScore | undefined {
  if (!realScore) return score

  return {
    homeScore: realScore.home,
    awayScore: realScore.away,
    ...(winnerTeamId ? { winnerTeamId } : {})
  }
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
  const teamName = team?.teamName ?? fallbackLabel

  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={`mb-2 flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <TeamFlag code={team?.flagCode} label={teamName} size="lg" />
      </div>

      <div className={`flex flex-wrap items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <p className="truncate text-base font-black text-white sm:text-lg">{teamName}</p>
        {team && <QualifiedPill provisional={provisional} />}
      </div>

      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {team ? team.shortName : 'Pending'}
      </p>

      {team && (
        <p className="mt-1 text-[10px] font-bold text-slate-500 sm:text-xs">
          {getTeamSeedDescription(team)}
        </p>
      )}
    </div>
  )
}

export function KnockoutMatchCard({ match }: KnockoutMatchCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const score = usePredictionStore((state) => state.scores[match.id])
  const updateScore = usePredictionStore((state) => state.updateScore)
  const setWinnerTeam = usePredictionStore((state) => state.setWinnerTeam)
  const fetchMatchData = useRealMatchStore((state) => state.fetchMatchData)

  const hasBothTeams = Boolean(match.homeTeam && match.awayTeam)
  const knockoutFixture = useMemo(() => getKnockoutFixture(match), [match])
  const realMatch = useRealMatchStore((state) => (knockoutFixture ? state.matches[knockoutFixture.id] : undefined))
  const realScore = hasUsableActualScore(realMatch?.score) ? realMatch.score : undefined
  const effectiveScore = getEffectiveScore(score, realScore, realMatch?.winnerTeamId)
  const hasBothScores = typeof effectiveScore?.homeScore === 'number' && typeof effectiveScore?.awayScore === 'number'
  const isDraw = hasBothScores && effectiveScore?.homeScore === effectiveScore?.awayScore && hasBothTeams
  const needsManualTiebreaker = isDraw && !effectiveScore?.winnerTeamId
  const modalHomeTeam = useMemo(() => getTeamFromQualifiedRow(match.homeTeam), [match.homeTeam])
  const modalAwayTeam = useMemo(() => getTeamFromQualifiedRow(match.awayTeam), [match.awayTeam])

  const winner = getKnockoutMatchWinner({
    match,
    score: effectiveScore
  })

  function openModal() {
    if (!knockoutFixture) return
    setModalOpen(true)
  }

  useEffect(() => {
    if (!knockoutFixture) return

    const fixture = knockoutFixture
    const kickoffDate = getFixtureKickoffDate(fixture)

    if (kickoffDate && kickoffDate.getTime() > Date.now()) return

    let cancelled = false

    async function loadRealScore() {
      await fetchMatchData(fixture, false, { silent: true })

      if (cancelled) return
    }

    void loadRealScore()

    return () => {
      cancelled = true
    }
  }, [fetchMatchData, knockoutFixture])

  useEffect(() => {
    if (!knockoutFixture || !realScore) return

    const currentScore = usePredictionStore.getState().scores[match.id]
    const shouldUpdateHome = currentScore?.homeScore !== realScore.home
    const shouldUpdateAway = currentScore?.awayScore !== realScore.away

    if (shouldUpdateHome) {
      updateScore(match.id, 'homeScore', realScore.home)
    }

    if (shouldUpdateAway) {
      updateScore(match.id, 'awayScore', realScore.away)
    }

    if (
      realScore.home === realScore.away &&
      realMatch?.winnerTeamId &&
      currentScore?.winnerTeamId !== realMatch.winnerTeamId
    ) {
      setWinnerTeam(match.id, realMatch.winnerTeamId)
    }
  }, [knockoutFixture, match.id, realMatch?.winnerTeamId, realScore, setWinnerTeam, updateScore])

  return (
    <>
      <article
        role={knockoutFixture ? 'button' : undefined}
        tabIndex={knockoutFixture ? 0 : undefined}
        onClick={openModal}
        onKeyDown={(event) => {
          if (!knockoutFixture) return

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openModal()
          }
        }}
        className={`group overflow-hidden rounded-2xl border p-3 shadow-lg transition hover:-translate-y-0.5 sm:p-4 ${
          knockoutFixture ? 'cursor-pointer' : 'cursor-default'
        } ${
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

            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-300">
              {knockoutStageLabels[match.stage]}
            </span>

            {realMatch && (
              <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-100">
                ESPN loaded
              </span>
            )}
          </div>

          {winner && (
            <span className="w-full rounded-full bg-emerald-300/15 px-3 py-2 text-center text-xs font-black text-emerald-200 ring-1 ring-emerald-300/25 sm:w-auto sm:py-1">
              {winner.shortName} advance
            </span>
          )}
        </div>

        {knockoutFixture && (
          <div className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-white/6 p-3 text-xs font-black text-slate-300 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="uppercase tracking-[0.16em] text-yellow-100">{formatLocalFixtureDateTime(knockoutFixture)}</p>
            <p className="text-slate-400 sm:text-right">
              {knockoutFixture.venue}, {knockoutFixture.city}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamSide team={match.homeTeam} fallbackLabel={match.homeLabel} />

          <div
            className="col-span-2 row-start-2 mx-auto w-full max-w-[18rem] rounded-2xl border border-white/10 bg-black/20 p-2 sm:col-span-1 sm:row-start-auto sm:w-auto sm:max-w-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                disabled={!hasBothTeams}
                value={effectiveScore?.homeScore ?? ''}
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
                value={effectiveScore?.awayScore ?? ''}
                onChange={(event) =>
                  updateScore(match.id, 'awayScore', parseScoreValue(event.target.value))
                }
                className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>

            {realMatch && (
              <div className="mt-2 rounded-xl border border-sky-300/15 bg-sky-300/10 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-200">ESPN actual</p>
                <p className="mt-1 text-sm font-black text-white">{realMatch.score.display}</p>
                {realMatch.penaltyShootout?.display && (
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Penalties {realMatch.penaltyShootout.display}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
            <TeamSide team={match.awayTeam} fallbackLabel={match.awayLabel} align="right" />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-3">
          {!hasBothTeams && (
            <p className="rounded-xl bg-yellow-300/10 px-3 py-3 text-center text-xs font-bold leading-5 text-yellow-100 sm:text-left">
              Complete or mathematically resolve the previous stage to resolve this match.
            </p>
          )}

          {needsManualTiebreaker && match.homeTeam && match.awayTeam && (
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-yellow-200 sm:tracking-[0.2em]">
                Draw after score — select advancing team
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {[match.homeTeam, match.awayTeam].map((team) => {
                  const isSelected = effectiveScore?.winnerTeamId === team.teamId

                  return (
                    <button
                      key={team.teamId}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setWinnerTeam(match.id, team.teamId)
                      }}
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

          {isDraw && effectiveScore?.winnerTeamId && winner && (
            <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
              Tie resolved by ESPN: {winner.teamName} advance
            </p>
          )}
        </div>
      </article>

      {knockoutFixture && (
        <RealMatchModal
          fixture={knockoutFixture}
          homeTeam={modalHomeTeam}
          awayTeam={modalAwayTeam}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
