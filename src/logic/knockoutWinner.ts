import type { PredictionScore, QualifiedTeamRow, ResolvedKnockoutMatch } from '../types/tournament'

export function getKnockoutMatchWinner(args: {
  match: ResolvedKnockoutMatch
  score?: PredictionScore
}): QualifiedTeamRow | undefined {
  const { match, score } = args

  if (
    !match.homeTeam ||
    !match.awayTeam ||
    typeof score?.homeScore !== 'number' ||
    typeof score?.awayScore !== 'number'
  ) {
    return undefined
  }

  if (score.homeScore > score.awayScore) {
    return match.homeTeam
  }

  if (score.awayScore > score.homeScore) {
    return match.awayTeam
  }

  if (score.winnerTeamId === match.homeTeam.teamId) {
    return match.homeTeam
  }

  if (score.winnerTeamId === match.awayTeam.teamId) {
    return match.awayTeam
  }

  return undefined
}

export function getKnockoutMatchLoser(args: {
  match: ResolvedKnockoutMatch
  score?: PredictionScore
}): QualifiedTeamRow | undefined {
  const { match, score } = args

  if (!match.homeTeam || !match.awayTeam) {
    return undefined
  }

  const winner = getKnockoutMatchWinner({ match, score })

  if (!winner) {
    return undefined
  }

  return winner.teamId === match.homeTeam.teamId ? match.awayTeam : match.homeTeam
}
