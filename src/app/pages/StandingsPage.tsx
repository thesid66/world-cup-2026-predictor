import { GroupStandingsSection } from '../../components/groups/GroupStandingsSection'
import { ThirdPlaceRanking } from '../../components/groups/ThirdPlaceRanking'

export function StandingsPage() {
  return (
    <div className="grid gap-6">
      <GroupStandingsSection />
      <ThirdPlaceRanking />
    </div>
  )
}
