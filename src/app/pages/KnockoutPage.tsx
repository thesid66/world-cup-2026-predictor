import { RoundOf32QualifiedTeams } from '../../components/knockout/RoundOf32QualifiedTeams'
import { RoundOf32Bracket } from '../../components/knockout/RoundOf32Bracket'
import { RoundOf16Bracket } from '../../components/knockout/RoundOf16Bracket'
import { FinalRounds } from '../../components/knockout/FinalRounds'

export function KnockoutPage() {
  return (
    <div className="grid gap-6">
      <RoundOf32QualifiedTeams />
      <RoundOf32Bracket />
      <RoundOf16Bracket />
      <FinalRounds />
    </div>
  )
}
