import type { RealMatchData } from '../types/realMatch'
import type { PredictionScore } from '../types/tournament'

function hasUsableRealScore(matchData?: RealMatchData) {
  if (!matchData) return false

  return typeof matchData.score.home === 'number' && typeof matchData.score.away === 'number'
}

function getRealWinnerTeamId(matchData: RealMatchData) {
  if (matchData.score.home !== matchData.score.away) {
    return undefined
  }

  return matchData.winnerTeamId
}

export function getScoresWithRealMatchData(
  scores: Record<string, PredictionScore>,
  realMatches: Record<string, RealMatchData>
): Record<string, PredictionScore> {
  const realScoreEntries = Object.entries(realMatches).filter(([, matchData]) =>
    hasUsableRealScore(matchData)
  )

  if (realScoreEntries.length === 0) {
    return scores
  }

  return realScoreEntries.reduce<Record<string, PredictionScore>>(
    (mergedScores, [fixtureId, matchData]) => {
      const homeScore = matchData.score.home
      const awayScore = matchData.score.away

      if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
        return mergedScores
      }

      const winnerTeamId = getRealWinnerTeamId(matchData)

      mergedScores[fixtureId] = {
        homeScore,
        awayScore,
        ...(winnerTeamId ? { winnerTeamId } : {})
      }

      return mergedScores
    },
    { ...scores }
  )
}
