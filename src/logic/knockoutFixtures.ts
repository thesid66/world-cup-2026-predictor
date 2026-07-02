import type { Fixture, QualifiedTeamRow, ResolvedKnockoutMatch, Team } from '../types/tournament'

export type KnockoutFixtureMetadata = Pick<
  Fixture,
  'date' | 'kickoffTime' | 'kickoffTimeSort' | 'venue' | 'city'
>

export const knockoutStageLabels: Record<ResolvedKnockoutMatch['stage'], string> = {
  round32: 'Round of 32',
  round16: 'Round of 16',
  quarterFinal: 'Quarter-final',
  semiFinal: 'Semi-final',
  thirdPlace: 'Third-place match',
  final: 'Final'
}

export const knockoutFixtureMetadataByMatchNumber: Record<number, KnockoutFixtureMetadata> = {
  73: {
    date: '2026-06-28',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  74: {
    date: '2026-06-29',
    kickoffTime: '4:30 PM ET',
    kickoffTimeSort: '16:30',
    venue: 'Gillette Stadium',
    city: 'Foxborough'
  },
  75: {
    date: '2026-06-29',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Estadio BBVA',
    city: 'Guadalupe'
  },
  76: {
    date: '2026-06-29',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'NRG Stadium',
    city: 'Houston'
  },
  77: {
    date: '2026-06-30',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  },
  78: {
    date: '2026-06-30',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  79: {
    date: '2026-06-30',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Estadio Azteca',
    city: 'Mexico City'
  },
  80: {
    date: '2026-07-01',
    kickoffTime: '12:00 PM ET',
    kickoffTimeSort: '12:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  81: {
    date: '2026-07-01',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: "Levi's Stadium",
    city: 'Santa Clara'
  },
  82: {
    date: '2026-07-01',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'Lumen Field',
    city: 'Seattle'
  },
  83: {
    date: '2026-07-02',
    kickoffTime: '7:00 PM ET',
    kickoffTimeSort: '19:00',
    venue: 'BMO Field',
    city: 'Toronto'
  },
  84: {
    date: '2026-07-02',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  85: {
    date: '2026-07-02',
    kickoffTime: '11:00 PM ET',
    kickoffTimeSort: '23:00',
    venue: 'BC Place',
    city: 'Vancouver'
  },
  86: {
    date: '2026-07-03',
    kickoffTime: '6:00 PM ET',
    kickoffTimeSort: '18:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  87: {
    date: '2026-07-03',
    kickoffTime: '9:30 PM ET',
    kickoffTimeSort: '21:30',
    venue: 'Arrowhead Stadium',
    city: 'Kansas City'
  },
  88: {
    date: '2026-07-03',
    kickoffTime: '2:00 PM ET',
    kickoffTimeSort: '14:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  89: {
    date: '2026-07-04',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Lincoln Financial Field',
    city: 'Philadelphia'
  },
  90: {
    date: '2026-07-04',
    kickoffTime: '1:00 PM ET',
    kickoffTimeSort: '13:00',
    venue: 'NRG Stadium',
    city: 'Houston'
  },
  91: {
    date: '2026-07-05',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  },
  92: {
    date: '2026-07-05',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: 'Estadio Azteca',
    city: 'Mexico City'
  },
  93: {
    date: '2026-07-06',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  94: {
    date: '2026-07-06',
    kickoffTime: '8:00 PM ET',
    kickoffTimeSort: '20:00',
    venue: 'Lumen Field',
    city: 'Seattle'
  },
  95: {
    date: '2026-07-07',
    kickoffTime: '12:00 PM ET',
    kickoffTimeSort: '12:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  96: {
    date: '2026-07-07',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'BC Place',
    city: 'Vancouver'
  },
  97: {
    date: '2026-07-09',
    kickoffTime: '4:00 PM ET',
    kickoffTimeSort: '16:00',
    venue: 'Gillette Stadium',
    city: 'Foxborough'
  },
  98: {
    date: '2026-07-10',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'SoFi Stadium',
    city: 'Inglewood'
  },
  99: {
    date: '2026-07-11',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  100: {
    date: '2026-07-11',
    kickoffTime: '9:00 PM ET',
    kickoffTimeSort: '21:00',
    venue: 'Arrowhead Stadium',
    city: 'Kansas City'
  },
  101: {
    date: '2026-07-14',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'AT&T Stadium',
    city: 'Arlington'
  },
  102: {
    date: '2026-07-15',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'Mercedes-Benz Stadium',
    city: 'Atlanta'
  },
  103: {
    date: '2026-07-18',
    kickoffTime: '5:00 PM ET',
    kickoffTimeSort: '17:00',
    venue: 'Hard Rock Stadium',
    city: 'Miami Gardens'
  },
  104: {
    date: '2026-07-19',
    kickoffTime: '3:00 PM ET',
    kickoffTimeSort: '15:00',
    venue: 'MetLife Stadium',
    city: 'East Rutherford'
  }
}

export function getTeamFromQualifiedRow(team?: QualifiedTeamRow): Team | undefined {
  if (!team) return undefined

  return {
    id: team.teamId,
    name: team.teamName,
    shortName: team.shortName,
    flagCode: team.flagCode,
    confederation: 'UEFA',
    group: team.group
  }
}

export function getKnockoutFixture(match: ResolvedKnockoutMatch): Fixture | null {
  const metadata = knockoutFixtureMetadataByMatchNumber[match.matchNumber]

  if (!metadata || !match.homeTeam || !match.awayTeam) {
    return null
  }

  return {
    id: match.id,
    matchNumber: match.matchNumber,
    stage: 'group',
    ...metadata,
    homeTeamId: match.homeTeam.teamId,
    awayTeamId: match.awayTeam.teamId
  }
}
