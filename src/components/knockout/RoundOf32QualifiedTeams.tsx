import { useTournamentData } from '../../context/TournamentDataContext'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { getQualifiedTeams } from '../../logic/qualifiedTeams'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import type { QualifiedTeamRow } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

function getSourceLabel(team: QualifiedTeamRow): string {
  if (team.qualificationSource === 'groupWinner') {
    return 'Group winner'
  }

  if (team.qualificationSource === 'groupRunnerUp') {
    return 'Runner-up'
  }

  return 'Best third place'
}

function getSourceClass(team: QualifiedTeamRow): string {
  if (team.qualificationSource === 'groupWinner') {
    return 'bg-yellow-300/15 text-yellow-200 ring-yellow-300/30'
  }

  if (team.qualificationSource === 'groupRunnerUp') {
    return 'bg-sky-300/15 text-sky-200 ring-sky-300/30'
  }

  return 'bg-emerald-300/15 text-emerald-200 ring-emerald-300/30'
}

function isLockedQualifier(team: QualifiedTeamRow) {
  return team.isGroupComplete || team.directQualificationStatus === 'qualified'
}

type QualifiedTeamCardProps = {
  team: QualifiedTeamRow
}

function QualifiedTeamCard({ team }: QualifiedTeamCardProps) {
  const isConfirmed = isLockedQualifier(team)

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 transition hover:-translate-y-0.5 hover:border-yellow-300/30 hover:bg-white/8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">
            {team.seedLabel}
          </span>

          {isConfirmed && (
            <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/30">
              Confirmed
            </span>
          )}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${getSourceClass(team)}`}
        >
          {getSourceLabel(team)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <TeamFlag code={team.flagCode} label={team.teamName} size="lg" />

        <div>
          <p className="text-lg font-black text-white">{team.teamName}</p>
          <p className="text-xs font-bold text-slate-500">
            Group {team.group} · {team.shortName}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-white/8 px-2 py-2">
          <p className="text-[10px] font-black uppercase text-slate-500">Pts</p>
          <p className="text-sm font-black text-yellow-300">{team.points}</p>
        </div>

        <div className="rounded-xl bg-white/8 px-2 py-2">
          <p className="text-[10px] font-black uppercase text-slate-500">GD</p>
          <p className="text-sm font-black text-white">{team.goalDifference}</p>
        </div>

        <div className="rounded-xl bg-white/8 px-2 py-2">
          <p className="text-[10px] font-black uppercase text-slate-500">GF</p>
          <p className="text-sm font-black text-white">{team.goalsFor}</p>
        </div>

        <div className="rounded-xl bg-white/8 px-2 py-2">
          <p className="text-[10px] font-black uppercase text-slate-500">P</p>
          <p className="text-sm font-black text-white">{team.played}</p>
        </div>
      </div>
    </article>
  )
}

export function RoundOf32QualifiedTeams() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const { groups, teams, fixtures } = useTournamentData()
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)

  const { directQualifiers, thirdPlaceQualifiers, allQualifiedTeams } = getQualifiedTeams(scores, {
    groups,
    teams,
    fixtures
  })

  const lockedQualifiedTeams = allQualifiedTeams.filter(isLockedQualifier).length

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-yellow-300">
            Knockout qualification
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">Round of 32 qualified teams</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This panel collects the top two teams from every group and combines them with the eight
            best third-placed teams.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:min-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p className="mt-1 text-3xl font-black text-white">{allQualifiedTeams.length}</p>
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Direct</p>
            <p className="mt-1 text-3xl font-black text-white">{directQualifiers.length}</p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Third</p>
            <p className="mt-1 text-3xl font-black text-white">{thirdPlaceQualifiers.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
        <p className="text-sm font-bold leading-6 text-yellow-100">
          {lockedQualifiedTeams < 32
            ? 'Some qualification positions are still provisional until the remaining group matches are scored.'
            : 'All 32 teams are ready for the knockout bracket.'}
        </p>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black text-white">Direct qualifiers</h3>

          <span className="rounded-full bg-sky-300/10 px-3 py-1 text-xs font-black text-sky-200 ring-1 ring-sky-300/20">
            24 teams
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {directQualifiers.map((team) => (
            <QualifiedTeamCard key={`${team.seedLabel}-${team.teamId}`} team={team} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black text-white">Best third-placed qualifiers</h3>

          <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/20">
            8 teams
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {thirdPlaceQualifiers.map((team) => (
            <QualifiedTeamCard key={`${team.seedLabel}-${team.teamId}`} team={team} />
          ))}
        </div>
      </div>
    </section>
  )
}
