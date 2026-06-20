import type { Fixture } from '../types/tournament'

const correctedKickoffTimes: Record<string, { date: string; kickoffTimeSort: string }> = {
  'match-031': {
    date: '2026-06-19',
    kickoffTimeSort: '20:30'
  },
  'match-032': {
    date: '2026-06-19',
    kickoffTimeSort: '23:00'
  }
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)

  return nextDate
}

function getCorrectedFixtureTime(fixture: Fixture) {
  return correctedKickoffTimes[fixture.id] ?? {
    date: fixture.date,
    kickoffTimeSort: fixture.kickoffTimeSort
  }
}

export function getFixtureKickoffDate(fixture: Fixture): Date | null {
  const correctedFixtureTime = getCorrectedFixtureTime(fixture)

  if (!correctedFixtureTime.kickoffTimeSort) {
    return null
  }

  const [hourValue, minuteValue] = correctedFixtureTime.kickoffTimeSort.split(':').map(Number)

  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) {
    return null
  }

  const [year, month, day] = correctedFixtureTime.date.split('-').map(Number)

  const isNextDayMidnight = hourValue >= 24
  const normalisedHour = isNextDayMidnight ? hourValue - 24 : hourValue

  const baseDate = new Date(Date.UTC(year, month - 1, day, normalisedHour, minuteValue))
  const etDate = isNextDayMidnight ? addDays(baseDate, 1) : baseDate

  /**
   * World Cup 2026 is in June/July.
   * Eastern Time during this period is EDT, UTC-4.
   * To convert ET local time to UTC, add 4 hours.
   */
  return new Date(etDate.getTime() + 4 * 60 * 60 * 1000)
}

export function formatLocalFixtureDateTime(fixture: Fixture) {
  const utcDate = getFixtureKickoffDate(fixture)

  if (!utcDate) {
    return 'Kick-off TBC'
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(utcDate)
}

export function formatLocalFixtureTime(fixture: Fixture) {
  const utcDate = getFixtureKickoffDate(fixture)

  if (!utcDate) {
    return 'TBC'
  }

  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(utcDate)
}
