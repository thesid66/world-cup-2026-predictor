import { fixtures as defaultFixtures } from '../data/fixtures'
import type { Fixture, GroupCode, PredictionScore } from '../types/tournament'

export function isFixturePredicted(fixture: Fixture, scores: Record<string, PredictionScore>) {
  const score = scores[fixture.id]

  return typeof score?.homeScore === 'number' && typeof score?.awayScore === 'number'
}

export function getGroupFixtures(group: GroupCode, fixtures: Fixture[] = defaultFixtures) {
  return fixtures.filter((fixture) => fixture.stage === 'group' && fixture.group === group)
}

export function getGroupProgress(
  group: GroupCode,
  scores: Record<string, PredictionScore>,
  fixtures: Fixture[] = defaultFixtures
) {
  const groupFixtures = getGroupFixtures(group, fixtures)

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

export function isGroupComplete(
  group: GroupCode,
  scores: Record<string, PredictionScore>,
  fixtures: Fixture[] = defaultFixtures
) {
  return getGroupProgress(group, scores, fixtures).isComplete
}

export function getGroupStageProgress(
  scores: Record<string, PredictionScore>,
  fixtures: Fixture[] = defaultFixtures
) {
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

export function isGroupStageComplete(
  scores: Record<string, PredictionScore>,
  fixtures: Fixture[] = defaultFixtures
) {
  return getGroupStageProgress(scores, fixtures).isComplete
}
