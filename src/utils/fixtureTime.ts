import type { Fixture } from '../types/tournament'

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)

  return nextDate
}

export function getFixtureKickoffDate(fixture: Fixture): Date | null {
  if (!fixture.kickoffTimeSort) {
    return null
  }

  const [hourValue, minuteValue] = fixture.kickoffTimeSort.split(':').map(Number)

  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) {
    return null
  }

  const [year, month, day] = fixture.date.split('-').map(Number)

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

export function formatNepalFixtureDateTime(fixture: Fixture) {
  const utcDate = getFixtureKickoffDate(fixture)

  if (!utcDate) {
    return 'Kick-off TBC'
  }

  return new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kathmandu',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(utcDate)
}

export function formatNepalFixtureTime(fixture: Fixture) {
  const utcDate = getFixtureKickoffDate(fixture)

  if (!utcDate) {
    return 'TBC'
  }

  return new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kathmandu',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(utcDate)
}
