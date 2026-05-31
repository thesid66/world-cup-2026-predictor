import type {
  GroupCode,
  KnockoutSlot,
  QualifiedTeamRow,
  ResolvedKnockoutMatch,
  RoundOf32SlotDefinition,
  PredictionScore
} from '../types/tournament'
import { getQualifiedTeams } from './qualifiedTeams'

export const roundOf32SlotDefinitions: RoundOf32SlotDefinition[] = [
  {
    id: 'match-073',
    matchNumber: 73,
    stage: 'round32',
    homeLabel: 'Runner-up Group A',
    awayLabel: 'Runner-up Group B',
    homeSlot: { type: 'groupPosition', group: 'A', position: 2 },
    awaySlot: { type: 'groupPosition', group: 'B', position: 2 }
  },
  {
    id: 'match-074',
    matchNumber: 74,
    stage: 'round32',
    homeLabel: 'Winner Group E',
    awayLabel: '3rd Group A/B/C/D/F',
    homeSlot: { type: 'groupPosition', group: 'E', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['A', 'B', 'C', 'D', 'F']
    }
  },
  {
    id: 'match-075',
    matchNumber: 75,
    stage: 'round32',
    homeLabel: 'Winner Group F',
    awayLabel: 'Runner-up Group C',
    homeSlot: { type: 'groupPosition', group: 'F', position: 1 },
    awaySlot: { type: 'groupPosition', group: 'C', position: 2 }
  },
  {
    id: 'match-076',
    matchNumber: 76,
    stage: 'round32',
    homeLabel: 'Winner Group C',
    awayLabel: 'Runner-up Group F',
    homeSlot: { type: 'groupPosition', group: 'C', position: 1 },
    awaySlot: { type: 'groupPosition', group: 'F', position: 2 }
  },
  {
    id: 'match-077',
    matchNumber: 77,
    stage: 'round32',
    homeLabel: 'Winner Group I',
    awayLabel: '3rd Group C/D/F/G/H',
    homeSlot: { type: 'groupPosition', group: 'I', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['C', 'D', 'F', 'G', 'H']
    }
  },
  {
    id: 'match-078',
    matchNumber: 78,
    stage: 'round32',
    homeLabel: 'Runner-up Group E',
    awayLabel: 'Runner-up Group I',
    homeSlot: { type: 'groupPosition', group: 'E', position: 2 },
    awaySlot: { type: 'groupPosition', group: 'I', position: 2 }
  },
  {
    id: 'match-079',
    matchNumber: 79,
    stage: 'round32',
    homeLabel: 'Winner Group A',
    awayLabel: '3rd Group C/E/F/H/I',
    homeSlot: { type: 'groupPosition', group: 'A', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['C', 'E', 'F', 'H', 'I']
    }
  },
  {
    id: 'match-080',
    matchNumber: 80,
    stage: 'round32',
    homeLabel: 'Winner Group L',
    awayLabel: '3rd Group E/H/I/J/K',
    homeSlot: { type: 'groupPosition', group: 'L', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['E', 'H', 'I', 'J', 'K']
    }
  },
  {
    id: 'match-081',
    matchNumber: 81,
    stage: 'round32',
    homeLabel: 'Winner Group D',
    awayLabel: '3rd Group B/E/F/I/J',
    homeSlot: { type: 'groupPosition', group: 'D', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['B', 'E', 'F', 'I', 'J']
    }
  },
  {
    id: 'match-082',
    matchNumber: 82,
    stage: 'round32',
    homeLabel: 'Winner Group G',
    awayLabel: '3rd Group A/E/H/I/J',
    homeSlot: { type: 'groupPosition', group: 'G', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['A', 'E', 'H', 'I', 'J']
    }
  },
  {
    id: 'match-083',
    matchNumber: 83,
    stage: 'round32',
    homeLabel: 'Runner-up Group K',
    awayLabel: 'Runner-up Group L',
    homeSlot: { type: 'groupPosition', group: 'K', position: 2 },
    awaySlot: { type: 'groupPosition', group: 'L', position: 2 }
  },
  {
    id: 'match-084',
    matchNumber: 84,
    stage: 'round32',
    homeLabel: 'Winner Group H',
    awayLabel: 'Runner-up Group J',
    homeSlot: { type: 'groupPosition', group: 'H', position: 1 },
    awaySlot: { type: 'groupPosition', group: 'J', position: 2 }
  },
  {
    id: 'match-085',
    matchNumber: 85,
    stage: 'round32',
    homeLabel: 'Winner Group B',
    awayLabel: '3rd Group E/F/G/I/J',
    homeSlot: { type: 'groupPosition', group: 'B', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['E', 'F', 'G', 'I', 'J']
    }
  },
  {
    id: 'match-086',
    matchNumber: 86,
    stage: 'round32',
    homeLabel: 'Winner Group J',
    awayLabel: 'Runner-up Group H',
    homeSlot: { type: 'groupPosition', group: 'J', position: 1 },
    awaySlot: { type: 'groupPosition', group: 'H', position: 2 }
  },
  {
    id: 'match-087',
    matchNumber: 87,
    stage: 'round32',
    homeLabel: 'Winner Group K',
    awayLabel: '3rd Group D/E/I/J/L',
    homeSlot: { type: 'groupPosition', group: 'K', position: 1 },
    awaySlot: {
      type: 'thirdPlace',
      eligibleGroups: ['D', 'E', 'I', 'J', 'L']
    }
  },
  {
    id: 'match-088',
    matchNumber: 88,
    stage: 'round32',
    homeLabel: 'Runner-up Group D',
    awayLabel: 'Runner-up Group G',
    homeSlot: { type: 'groupPosition', group: 'D', position: 2 },
    awaySlot: { type: 'groupPosition', group: 'G', position: 2 }
  }
]

type ThirdPlaceSlot = {
  key: string
  eligibleGroups: GroupCode[]
}

function getThirdPlaceSlots(): ThirdPlaceSlot[] {
  return roundOf32SlotDefinitions.flatMap((definition) => {
    const slots: ThirdPlaceSlot[] = []

    if (definition.homeSlot.type === 'thirdPlace') {
      slots.push({
        key: `${definition.id}-home`,
        eligibleGroups: definition.homeSlot.eligibleGroups
      })
    }

    if (definition.awaySlot.type === 'thirdPlace') {
      slots.push({
        key: `${definition.id}-away`,
        eligibleGroups: definition.awaySlot.eligibleGroups
      })
    }

    return slots
  })
}

function resolveThirdPlaceAssignments(
  thirdPlaceQualifiers: QualifiedTeamRow[]
): Record<string, QualifiedTeamRow> {
  const thirdSlots = getThirdPlaceSlots()

  const sortedSlots = [...thirdSlots].sort((a, b) => {
    const aCount = thirdPlaceQualifiers.filter((team) =>
      a.eligibleGroups.includes(team.group)
    ).length

    const bCount = thirdPlaceQualifiers.filter((team) =>
      b.eligibleGroups.includes(team.group)
    ).length

    return aCount - bCount
  })

  function backtrack(
    index: number,
    usedTeamIds: Set<string>,
    assignments: Record<string, QualifiedTeamRow>
  ): Record<string, QualifiedTeamRow> | null {
    if (index >= sortedSlots.length) {
      return assignments
    }

    const slot = sortedSlots[index]

    const candidates = thirdPlaceQualifiers.filter(
      (team) => slot.eligibleGroups.includes(team.group) && !usedTeamIds.has(team.teamId)
    )

    for (const candidate of candidates) {
      const nextUsedTeamIds = new Set(usedTeamIds)
      nextUsedTeamIds.add(candidate.teamId)

      const result = backtrack(index + 1, nextUsedTeamIds, {
        ...assignments,
        [slot.key]: candidate
      })

      if (result) {
        return result
      }
    }

    return null
  }

  return backtrack(0, new Set(), {}) ?? {}
}

function resolveGroupPositionTeam(
  directQualifiers: QualifiedTeamRow[],
  group: GroupCode,
  position: 1 | 2
): QualifiedTeamRow | undefined {
  return directQualifiers.find((team) => team.group === group && team.groupPosition === position)
}

function resolveSlotTeam(args: {
  slot: KnockoutSlot
  slotKey: string
  directQualifiers: QualifiedTeamRow[]
  thirdPlaceAssignments: Record<string, QualifiedTeamRow>
}): QualifiedTeamRow | undefined {
  const { slot, slotKey, directQualifiers, thirdPlaceAssignments } = args

  if (slot.type === 'groupPosition') {
    return resolveGroupPositionTeam(directQualifiers, slot.group, slot.position)
  }

  return thirdPlaceAssignments[slotKey]
}

export function getRoundOf32Matches(
  scores: Record<string, PredictionScore>
): ResolvedKnockoutMatch[] {
  const { directQualifiers, thirdPlaceQualifiers } = getQualifiedTeams(scores)
  const thirdPlaceAssignments = resolveThirdPlaceAssignments(thirdPlaceQualifiers)

  return roundOf32SlotDefinitions.map((definition) => {
    const homeSlotKey = `${definition.id}-home`
    const awaySlotKey = `${definition.id}-away`

    return {
      id: definition.id,
      matchNumber: definition.matchNumber,
      stage: definition.stage,
      homeLabel: definition.homeLabel,
      awayLabel: definition.awayLabel,
      homeTeam: resolveSlotTeam({
        slot: definition.homeSlot,
        slotKey: homeSlotKey,
        directQualifiers,
        thirdPlaceAssignments
      }),
      awayTeam: resolveSlotTeam({
        slot: definition.awaySlot,
        slotKey: awaySlotKey,
        directQualifiers,
        thirdPlaceAssignments
      })
    }
  })
}
