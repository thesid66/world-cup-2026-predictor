export type RealMatchStatus = {
  long?: string
  short?: string
  elapsed?: number | null
}

export type RealMatchScore = {
  home: number | null
  away: number | null
  display: string
}

export type RealMatchTeam = {
  id?: number | string
  name: string
  logo?: string
}

export type RealMatchStatistic = {
  type: string
  value: string | number | null
}

export type RealMatchTeamStatistics = {
  teamId?: number | string
  teamName: string
  teamLogo?: string
  statistics: RealMatchStatistic[]
}

export type RealMatchEvent = {
  elapsed?: number | null
  extra?: number | null
  teamName?: string
  playerName?: string
  assistName?: string
  type?: string
  detail?: string
}

export type RealMatchData = {
  provider: 'api-football' | 'sportscore'
  apiFixtureId: number | string
  fetchedAt: string
  status: RealMatchStatus
  homeTeam: RealMatchTeam
  awayTeam: RealMatchTeam
  score: RealMatchScore
  statistics: RealMatchTeamStatistics[]
  events: RealMatchEvent[]
}
