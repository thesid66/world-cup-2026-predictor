import { useTournamentData } from '../../context/TournamentDataContext'
import { GroupStandings } from './GroupStandings'

export function GroupStandingsSection() {
  const { groups } = useTournamentData()

  return (
    <section id="standings" className="mt-4 scroll-mt-4 sm:mt-6 sm:scroll-mt-6">
      <div className="mb-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-4xl">
        <div className="relative p-4 sm:p-6">
          <div className="absolute inset-0 bg-linear-to-r from-emerald-300/10 via-sky-400/10 to-yellow-300/10" />

          <div className="relative min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300 sm:text-sm sm:tracking-[0.35em]">
              Group tables
            </p>

            <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              Live group standings
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              These tables update automatically from your score predictions. First and second place
              qualify directly, while third place enters the best-third ranking.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        {groups.map((group) => (
          <GroupStandings key={group.code} groupCode={group.code} />
        ))}
      </div>
    </section>
  )
}
