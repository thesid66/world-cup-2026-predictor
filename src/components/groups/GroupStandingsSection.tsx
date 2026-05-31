import { groups } from '../../data/groups'
import { GroupStandings } from './GroupStandings'

export function GroupStandingsSection() {
  return (
    <section id="standings" className="mt-6 scroll-mt-6">
      <div className="mb-6 overflow-hidden rounded-4xl border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-linear-to-r from-emerald-300/10 via-sky-400/10 to-yellow-300/10" />

          <div className="relative">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
              Group tables
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Live group standings
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              These tables update automatically from your score predictions. First and second place
              qualify directly, while third place enters the best-third ranking.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((group) => (
          <GroupStandings key={group.code} groupCode={group.code} />
        ))}
      </div>
    </section>
  )
}
