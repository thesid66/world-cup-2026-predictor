import { teams } from '../../data/teams'
import type { GroupCode } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type GroupTeamBadgesProps = {
  groupCode: GroupCode
}

export function GroupTeamBadges({ groupCode }: GroupTeamBadgesProps) {
  const groupTeams = teams.filter((team) => team.group === groupCode)

  return (
    <div className="flex flex-wrap gap-2">
      {groupTeams.map((team) => (
        <span
          key={team.id}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black text-slate-300"
        >
          <TeamFlag code={team.flagCode} label={team.name} size="sm" />
          {team.shortName}
        </span>
      ))}
    </div>
  )
}
