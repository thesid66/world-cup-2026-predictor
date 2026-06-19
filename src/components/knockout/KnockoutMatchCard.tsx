import type { QualifiedTeamRow, ResolvedKnockoutMatch } from '../../types/tournament'
import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import { usePredictionStore } from '../../store/predictionStore'
import { TeamFlag } from '../ui/TeamFlag'

type KnockoutMatchCardProps = {
  match: ResolvedKnockoutMatch
}

const stageLabels: Record<ResolvedKnockoutMatch['stage'], string> = {
  round32: 'Round of 32',
  round16: 'Round of 16',
  quarterFinal: 'Quarter-final',
  semiFinal: 'Semi-final',
  thirdPlace: 'Third-place match',
  final: 'Final'
}

function parseScoreValue(value: string): number | null {
  if (value === '') return null

  const parsed = Number(value)

  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }

  return parsed
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

  const hasBothTeams = Boolean(match.homeTeam && match.awayTeam)
  const hasBothScores = typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
  const isDraw = hasBothScores && score?.homeScore === score?.awayScore && hasBothTeams

  const winner = getKnockoutMatchWinner({
    match,
    score
  })

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
