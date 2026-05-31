import { fixtures } from '../data/fixtures'
import type { Fixture, GroupCode, PredictionScore } from '../types/tournament'

export function isFixturePredicted(fixture: Fixture, scores: Record<string, PredictionScore>) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

export function getGroupFixtures(group: GroupCode) {
  return fixtures.filter((fixture) => fixture.stage === 'group' && fixture.group === group)
}

export function getGroupProgress(group: GroupCode, scores: Record<string, PredictionScore>) {
  const groupFixtures = getGroupFixtures(group)

  const completed = groupFixtures.filter((fixture) => isFixturePredicted(fixture, scores)).length

  const total = groupFixtures.length

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    hasStarted: completed > 0,
    isComplete: total > 0 && completed === total
  }
}

export function isGroupComplete(group: GroupCode, scores: Record<string, PredictionScore>) {
  return getGroupProgress(group, scores).isComplete
}

export function getGroupStageProgress(scores: Record<string, PredictionScore>) {
  const groupStageFixtures = fixtures.filter((fixture) => fixture.stage === 'group')

  const completed = groupStageFixtures.filter((fixture) =>
    isFixturePredicted(fixture, scores)
  ).length

  const total = groupStageFixtures.length

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    hasStarted: completed > 0,
    isComplete: total > 0 && completed === total
  }
}

export function isGroupStageComplete(scores: Record<string, PredictionScore>) {
  return getGroupStageProgress(scores).isComplete
}
