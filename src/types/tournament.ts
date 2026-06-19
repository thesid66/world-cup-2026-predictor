export type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

export type Stage =
  | 'group'
  | 'round32'
  | 'round16'
  | 'quarterFinal'
  | 'semiFinal'
  | 'thirdPlace'
  | 'final'

export type Confederation = 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA'

export type Team = {
  id: string
  name: string
  shortName: string
  flagCode: string
  confederation: Confederation
  group: GroupCode
}

export type Group = {
  code: GroupCode
  name: string
}

export type Fixture = {
  id: string
  matchNumber: number
  stage: Stage
  group?: GroupCode
  date: string
  kickoffTime?: string
  kickoffTimeSort?: string
  apiFootballFixtureId?: number
  venue: string
  city: string
  homeTeamId: string
  awayTeamId: string
}

export type PredictionScore = {
  homeScore: number | null
  awayScore: number | null
  winnerTeamId?: string
}

export type MatchPrediction = {
  fixtureId: string
  score: PredictionScore
}

export type DirectQualificationStatus = 'qualified' | 'pending'

export type GroupTableRow = {
  teamId: string
  teamName: string
  shortName: string
  flagCode: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  directQualificationStatus?: DirectQualificationStatus
}
export type ThirdPlaceTableRow = GroupTableRow & {
  group: GroupCode
  groupName: string
  isGroupComplete: boolean
  qualificationStatus: 'qualified' | 'waiting' | 'eliminated'
}
export type QualificationSource = 'groupWinner' | 'groupRunnerUp' | 'thirdPlace'

export type QualifiedTeamRow = GroupTableRow & {
  group: GroupCode
  groupName: string
  groupPosition: number
  qualificationSource: QualificationSource
  isGroupComplete: boolean
  seedLabel: string
}

export type QualifiedTeamsResult = {
  directQualifiers: QualifiedTeamRow[]
  thirdPlaceQualifiers: QualifiedTeamRow[]
  allQualifiedTeams: QualifiedTeamRow[]
}
export type KnockoutSlot =
  | {
      type: 'groupPosition'
      group: GroupCode
      position: 1 | 2
    }
  | {
      type: 'thirdPlace'
      eligibleGroups: GroupCode[]
    }

export type RoundOf32SlotDefinition = {
  id: string
  matchNumber: number
  stage: 'round32'
  homeSlot: KnockoutSlot
  awaySlot: KnockoutSlot
  homeLabel: string
  awayLabel: string
}

export type KnockoutStage =
  | 'round32'
  | 'round16'
  | 'quarterFinal'
  | 'semiFinal'
  | 'thirdPlace'
  | 'final'

export type ResolvedKnockoutMatch = {
  id: string
  matchNumber: number
  stage: KnockoutStage
  homeTeam?: QualifiedTeamRow
  awayTeam?: QualifiedTeamRow
  homeLabel: string
  awayLabel: string
}
