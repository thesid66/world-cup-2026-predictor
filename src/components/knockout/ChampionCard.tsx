import { Trophy } from 'lucide-react'
import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import { usePredictionStore } from '../../store/predictionStore'
import type { ResolvedKnockoutMatch } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type ChampionCardProps = {
  finalMatch?: ResolvedKnockoutMatch
}

export function ChampionCard({ finalMatch }: ChampionCardProps) {
  const scores = usePredictionStore((state) => state.scores)

  const champion = finalMatch
    ? getKnockoutMatchWinner({
        match: finalMatch,
        score: scores[finalMatch.id]
      })
    : undefined

  return (
    <section
      id="champion"
      className="mt-6 overflow-hidden rounded-4xl border border-yellow-300/20 bg-yellow-300/10 shadow-2xl backdrop-blur-xl"
    >
      <div className="relative p-6 sm:p-8">
        <div className="absolute inset-0 bg-linear-to-br from-yellow-300/20 via-white/5 to-sky-300/10" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-200">
              Prediction result
            </p>

            <h2 className="mt-2 text-3xl font-black text-white sm:text-5xl">
              Your World Cup 2026 Champion
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-yellow-50/80">
              Complete the final score to reveal the champion of your prediction.
            </p>
          </div>

          <div className="rounded-4xl border border-yellow-300/30 bg-slate-950/60 p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-300 text-yellow-950 shadow-lg">
              <Trophy className="size-10" />
            </div>

            {champion ? (
              <>
                <div className="mb-3 flex justify-center">
                  <TeamFlag code={champion.flagCode} label={champion.teamName} size="lg" />
                </div>

                <p className="text-4xl font-black text-white">{champion.teamName}</p>

                <p className="mt-2 text-sm font-black uppercase tracking-[0.25em] text-yellow-200">
                  {champion.shortName}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-white">Not decided yet</p>

                <p className="mt-2 text-sm font-bold text-slate-400">
                  Finish the final match first.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
