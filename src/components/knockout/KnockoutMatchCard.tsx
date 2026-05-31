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

function TeamSide({
  team,
  fallbackLabel,
  align = 'left'
}: {
  team?: QualifiedTeamRow
  fallbackLabel: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'left' && <TeamFlag code={team?.flagCode} label={team?.teamName} size="lg" />}

      <div>
        <p className="font-black text-white">{team ? team.teamName : fallbackLabel}</p>
        <p className="text-xs font-bold text-slate-500">
          {team ? `${team.seedLabel} · ${team.shortName}` : 'Pending'}
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
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
            Match {match.matchNumber}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">{stageLabels[match.stage]}</p>
        </div>

        {winner && (
          <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/25">
            {winner.shortName} advance
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide team={match.homeTeam} fallbackLabel={match.homeLabel} />

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
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
            disabled={!hasBothTeams}
            value={score?.awayScore ?? ''}
            onChange={(event) =>
              updateScore(match.id, 'awayScore', parseScoreValue(event.target.value))
            }
            className="h-12 w-14 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-black text-white outline-none transition focus:border-yellow-300 focus:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        <TeamSide team={match.awayTeam} fallbackLabel={match.awayLabel} align="right" />
      </div>

      {!hasBothTeams && (
        <p className="mt-4 rounded-xl bg-yellow-300/10 px-3 py-2 text-xs font-bold text-yellow-100">
          Complete the previous stage first to resolve this match.
        </p>
      )}

      {isDraw && match.homeTeam && match.awayTeam && (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-300/10 p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-yellow-200">
            Draw after score — select winner
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {[match.homeTeam, match.awayTeam].map((team) => {
              const isSelected = score?.winnerTeamId === team.teamId

              return (
                <button
                  key={team.teamId}
                  type="button"
                  onClick={() => setWinnerTeam(match.id, team.teamId)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition ${
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
    </article>
  )
}
