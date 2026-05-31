import type {
  KnockoutStage,
  PredictionScore,
  QualifiedTeamRow,
  ResolvedKnockoutMatch
} from '../types/tournament'
import { getKnockoutMatchLoser, getKnockoutMatchWinner } from './knockoutWinner'
import { getRoundOf16Matches } from './roundOf16'

type SourceType = 'winner' | 'loser'

type KnockoutDefinition = {
  id: string
  matchNumber: number
  stage: KnockoutStage
  homeSourceMatchNumber: number
  awaySourceMatchNumber: number
  homeSourceType?: SourceType
  awaySourceType?: SourceType
  homeLabel: string
  awayLabel: string
}

const quarterFinalDefinitions: KnockoutDefinition[] = [
  {
    id: 'match-097',
    matchNumber: 97,
    stage: 'quarterFinal',
    homeSourceMatchNumber: 89,
    awaySourceMatchNumber: 90,
    homeLabel: 'Winner Match 89',
    awayLabel: 'Winner Match 90'
  },
  {
    id: 'match-098',
    matchNumber: 98,
    stage: 'quarterFinal',
    homeSourceMatchNumber: 93,
    awaySourceMatchNumber: 94,
    homeLabel: 'Winner Match 93',
    awayLabel: 'Winner Match 94'
  },
  {
    id: 'match-099',
    matchNumber: 99,
    stage: 'quarterFinal',
    homeSourceMatchNumber: 91,
    awaySourceMatchNumber: 92,
    homeLabel: 'Winner Match 91',
    awayLabel: 'Winner Match 92'
  },
  {
    id: 'match-100',
    matchNumber: 100,
    stage: 'quarterFinal',
    homeSourceMatchNumber: 95,
    awaySourceMatchNumber: 96,
    homeLabel: 'Winner Match 95',
    awayLabel: 'Winner Match 96'
  }
]

const semiFinalDefinitions: KnockoutDefinition[] = [
  {
    id: 'match-101',
    matchNumber: 101,
    stage: 'semiFinal',
    homeSourceMatchNumber: 97,
    awaySourceMatchNumber: 98,
    homeLabel: 'Winner Match 97',
    awayLabel: 'Winner Match 98'
  },
  {
    id: 'match-102',
    matchNumber: 102,
    stage: 'semiFinal',
    homeSourceMatchNumber: 99,
    awaySourceMatchNumber: 100,
    homeLabel: 'Winner Match 99',
    awayLabel: 'Winner Match 100'
  }
]

const thirdPlaceDefinition: KnockoutDefinition[] = [
  {
    id: 'match-103',
    matchNumber: 103,
    stage: 'thirdPlace',
    homeSourceMatchNumber: 101,
    awaySourceMatchNumber: 102,
    homeSourceType: 'loser',
    awaySourceType: 'loser',
    homeLabel: 'Loser Match 101',
    awayLabel: 'Loser Match 102'
  }
]

const finalDefinition: KnockoutDefinition[] = [
  {
    id: 'match-104',
    matchNumber: 104,
    stage: 'final',
    homeSourceMatchNumber: 101,
    awaySourceMatchNumber: 102,
    homeLabel: 'Winner Match 101',
    awayLabel: 'Winner Match 102'
  }
]

function getTeamFromSource(args: {
  sourceMatchNumber: number
  sourceType?: SourceType
  sourceMatches: ResolvedKnockoutMatch[]
  scores: Record<string, PredictionScore>
}): QualifiedTeamRow | undefined {
  const { sourceMatchNumber, sourceType = 'winner', sourceMatches, scores } = args

  const sourceMatch = sourceMatches.find((match) => match.matchNumber === sourceMatchNumber)

  if (!sourceMatch) {
    return undefined
  }

  if (sourceType === 'loser') {
    return getKnockoutMatchLoser({
      match: sourceMatch,
      score: scores[sourceMatch.id]
    })
  }

  return getKnockoutMatchWinner({
    match: sourceMatch,
    score: scores[sourceMatch.id]
  })
}

function resolveMatches(args: {
  definitions: KnockoutDefinition[]
  sourceMatches: ResolvedKnockoutMatch[]
  scores: Record<string, PredictionScore>
}): ResolvedKnockoutMatch[] {
  const { definitions, sourceMatches, scores } = args

  return definitions.map((definition) => ({
    id: definition.id,
    matchNumber: definition.matchNumber,
    stage: definition.stage,
    homeLabel: definition.homeLabel,
    awayLabel: definition.awayLabel,
    homeTeam: getTeamFromSource({
      sourceMatchNumber: definition.homeSourceMatchNumber,
      sourceType: definition.homeSourceType,
      sourceMatches,
      scores
    }),
    awayTeam: getTeamFromSource({
      sourceMatchNumber: definition.awaySourceMatchNumber,
      sourceType: definition.awaySourceType,
      sourceMatches,
      scores
    })
  }))
}

export function getQuarterFinalMatches(
  scores: Record<string, PredictionScore>
): ResolvedKnockoutMatch[] {
  const roundOf16Matches = getRoundOf16Matches(scores)

  return resolveMatches({
    definitions: quarterFinalDefinitions,
    sourceMatches: roundOf16Matches,
    scores
  })
}

export function getSemiFinalMatches(
  scores: Record<string, PredictionScore>
): ResolvedKnockoutMatch[] {
  const quarterFinalMatches = getQuarterFinalMatches(scores)

  return resolveMatches({
    definitions: semiFinalDefinitions,
    sourceMatches: quarterFinalMatches,
    scores
  })
}

export function getThirdPlaceMatch(
  scores: Record<string, PredictionScore>
): ResolvedKnockoutMatch[] {
  const semiFinalMatches = getSemiFinalMatches(scores)

  return resolveMatches({
    definitions: thirdPlaceDefinition,
    sourceMatches: semiFinalMatches,
    scores
  })
}

export function getFinalMatch(scores: Record<string, PredictionScore>): ResolvedKnockoutMatch[] {
  const semiFinalMatches = getSemiFinalMatches(scores)

  return resolveMatches({
    definitions: finalDefinition,
    sourceMatches: semiFinalMatches,
    scores
  })
}
