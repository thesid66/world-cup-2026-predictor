import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import { getRoundOf32Matches } from '../../logic/roundOf32'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { KnockoutMatchCard } from './KnockoutMatchCard'

export function RoundOf32Bracket() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { groups, teams, fixtures } = useTournamentData()
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)
  const matches = getRoundOf32Matches(scores, { groups, teams, fixtures })

  const resolvedMatches = matches.filter((match) => match.homeTeam && match.awayTeam).length

  const completedMatches = matches.filter((match) =>
    Boolean(
      getKnockoutMatchWinner({
        match,
        score: scores[match.id]
      })
    )
  ).length

  return (
    <section
      id="knockout"
      className="mt-6 scroll-mt-6 rounded-4xl border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
    >
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-yellow-300">
            Knockout stage
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">Round of 32 bracket</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            These matches are generated from your predicted group tables and best third-placed
            teams. Enter knockout scores manually. If a match is drawn, choose the winner.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-80">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resolved</p>
            <p className="mt-1 text-3xl font-black text-white">{resolvedMatches}/16</p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              Completed
            </p>
            <p className="mt-1 text-3xl font-black text-white">{completedMatches}/16</p>
          </div>
        </div>
      </div>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((match) => (
          <KnockoutMatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  )
}
