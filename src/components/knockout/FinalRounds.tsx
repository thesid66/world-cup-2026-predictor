import {
  getFinalMatch,
  getQuarterFinalMatches,
  getSemiFinalMatches,
  getThirdPlaceMatch
} from '../../logic/finalRounds'
import { getScoresWithRealMatchData } from '../../logic/effectiveScores'
import { usePredictionStore } from '../../store/predictionStore'
import { useRealMatchStore } from '../../store/realMatchStore'
import { ChampionCard } from './ChampionCard'
import { KnockoutRoundSection } from './KnockoutRoundSection'

export function FinalRounds() {
  const predictionScores = usePredictionStore((state) => state.scores)
  const realMatches = useRealMatchStore((state) => state.matches)
  const scores = getScoresWithRealMatchData(predictionScores, realMatches)

  const quarterFinals = getQuarterFinalMatches(scores)
  const semiFinals = getSemiFinalMatches(scores)
  const thirdPlace = getThirdPlaceMatch(scores)
  const final = getFinalMatch(scores)

  return (
    <>
      <KnockoutRoundSection
        eyebrow="Knockout stage"
        title="Quarter-finals"
        description="Round of 16 winners flow into the quarter-finals automatically."
        matches={quarterFinals}
        totalMatches={4}
        accent="sky"
      />

      <KnockoutRoundSection
        eyebrow="Road to glory"
        title="Semi-finals"
        description="Quarter-final winners advance here. The winners go to the final, while the losers move into the third-place match."
        matches={semiFinals}
        totalMatches={2}
        accent="emerald"
      />

      <KnockoutRoundSection
        eyebrow="Bronze final"
        title="Third-place match"
        description="The two semi-final losers meet here."
        matches={thirdPlace}
        totalMatches={1}
        accent="rose"
      />

      <KnockoutRoundSection
        eyebrow="World Cup final"
        title="Final"
        description="The two semi-final winners meet here. Complete this match to reveal your predicted champion."
        matches={final}
        totalMatches={1}
        accent="yellow"
      />

      <ChampionCard finalMatch={final[0]} />
    </>
  )
}
