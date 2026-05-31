import type { PredictionScore, QualifiedTeamRow, ResolvedKnockoutMatch } from '../types/tournament'
import { getKnockoutMatchWinner } from './knockoutWinner'
import { getRoundOf32Matches } from './roundOf32'

type RoundOf16Definition = {
  id: string
  matchNumber: number
  homeSourceMatchNumber: number
  awaySourceMatchNumber: number
  homeLabel: string
  awayLabel: string
}

export const roundOf16Definitions: RoundOf16Definition[] = [
  {
    id: 'match-089',
    matchNumber: 89,
    homeSourceMatchNumber: 74,
    awaySourceMatchNumber: 77,
    homeLabel: 'Winner Match 74',
    awayLabel: 'Winner Match 77'
  },
  {
    id: 'match-090',
    matchNumber: 90,
    homeSourceMatchNumber: 73,
    awaySourceMatchNumber: 75,
    homeLabel: 'Winner Match 73',
    awayLabel: 'Winner Match 75'
  },
  {
    id: 'match-091',
    matchNumber: 91,
    homeSourceMatchNumber: 76,
    awaySourceMatchNumber: 78,
    homeLabel: 'Winner Match 76',
    awayLabel: 'Winner Match 78'
  },
  {
    id: 'match-092',
    matchNumber: 92,
    homeSourceMatchNumber: 79,
    awaySourceMatchNumber: 80,
    homeLabel: 'Winner Match 79',
    awayLabel: 'Winner Match 80'
  },
  {
    id: 'match-093',
    matchNumber: 93,
    homeSourceMatchNumber: 83,
    awaySourceMatchNumber: 84,
    homeLabel: 'Winner Match 83',
    awayLabel: 'Winner Match 84'
  },
  {
    id: 'match-094',
    matchNumber: 94,
    homeSourceMatchNumber: 81,
    awaySourceMatchNumber: 82,
    homeLabel: 'Winner Match 81',
    awayLabel: 'Winner Match 82'
  },
  {
    id: 'match-095',
    matchNumber: 95,
    homeSourceMatchNumber: 86,
    awaySourceMatchNumber: 88,
    homeLabel: 'Winner Match 86',
    awayLabel: 'Winner Match 88'
  },
  {
    id: 'match-096',
    matchNumber: 96,
    homeSourceMatchNumber: 85,
    awaySourceMatchNumber: 87,
    homeLabel: 'Winner Match 85',
    awayLabel: 'Winner Match 87'
  }
]

function getWinnerFromMatchNumber(args: {
  matchNumber: number
  roundOf32Matches: ResolvedKnockoutMatch[]
  scores: Record<string, PredictionScore>
}): QualifiedTeamRow | undefined {
  const { matchNumber, roundOf32Matches, scores } = args

  const sourceMatch = roundOf32Matches.find((match) => match.matchNumber === matchNumber)

  if (!sourceMatch) {
    return undefined
  }

  return getKnockoutMatchWinner({
    match: sourceMatch,
    score: scores[sourceMatch.id]
  })
}

export function getRoundOf16Matches(
  scores: Record<string, PredictionScore>
): ResolvedKnockoutMatch[] {
  const roundOf32Matches = getRoundOf32Matches(scores)

  return roundOf16Definitions.map((definition) => ({
    id: definition.id,
    matchNumber: definition.matchNumber,
    stage: 'round16',
    homeLabel: definition.homeLabel,
    awayLabel: definition.awayLabel,
    homeTeam: getWinnerFromMatchNumber({
      matchNumber: definition.homeSourceMatchNumber,
      roundOf32Matches,
      scores
    }),
    awayTeam: getWinnerFromMatchNumber({
      matchNumber: definition.awaySourceMatchNumber,
      roundOf32Matches,
      scores
    })
  }))
}
