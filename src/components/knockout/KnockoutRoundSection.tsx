import { getKnockoutMatchWinner } from '../../logic/knockoutWinner'
import { usePredictionStore } from '../../store/predictionStore'
import type { ResolvedKnockoutMatch } from '../../types/tournament'
import { KnockoutMatchCard } from './KnockoutMatchCard'

type KnockoutRoundSectionProps = {
  eyebrow: string
  title: string
  description: string
  matches: ResolvedKnockoutMatch[]
  totalMatches: number
  accent?: 'yellow' | 'emerald' | 'sky' | 'rose'
}

const accentClasses = {
  yellow: {
    eyebrow: 'text-yellow-300',
    box: 'border-yellow-300/20 bg-yellow-300/10',
    label: 'text-yellow-200'
  },
  emerald: {
    eyebrow: 'text-emerald-300',
    box: 'border-emerald-300/20 bg-emerald-300/10',
    label: 'text-emerald-200'
  },
  sky: {
    eyebrow: 'text-sky-300',
    box: 'border-sky-300/20 bg-sky-300/10',
    label: 'text-sky-200'
  },
  rose: {
    eyebrow: 'text-rose-300',
    box: 'border-rose-300/20 bg-rose-300/10',
    label: 'text-rose-200'
  }
}

export function KnockoutRoundSection({
  eyebrow,
  title,
  description,
  matches,
  totalMatches,
  accent = 'emerald'
}: KnockoutRoundSectionProps) {
  const scores = usePredictionStore((state) => state.scores)
  const color = accentClasses[accent]

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
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className={`text-sm font-black uppercase tracking-[0.3em] ${color.eyebrow}`}>
            {eyebrow}
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-80">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resolved</p>
            <p className="mt-1 text-3xl font-black text-white">
              {resolvedMatches}/{totalMatches}
            </p>
          </div>

          <div className={`rounded-2xl border p-4 text-center ${color.box}`}>
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${color.label}`}>
              Completed
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {completedMatches}/{totalMatches}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          matches.length === 1 ? 'mx-auto w-full max-w-3xl xl:grid-cols-1' : 'xl:grid-cols-2'
        }`}
      >
        {matches.map((match) => (
          <KnockoutMatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  )
}
