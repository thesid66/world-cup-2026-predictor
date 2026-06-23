import type { RealMatchData } from '../types/realMatch'
import type { PredictionScore } from '../types/tournament'

function hasUsableRealScore(matchData?: RealMatchData) {
  return typeof matchData?.score.home === 'number' && typeof matchData.score.away === 'number'
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

      mergedScores[fixtureId] = {
        ...mergedScores[fixtureId],
        homeScore,
        awayScore
      }

      return mergedScores
    },
    { ...scores }
  )
}
