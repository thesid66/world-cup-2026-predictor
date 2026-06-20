import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canFetchEspnWorldCupMatchData, fetchEspnWorldCupMatchDataForFixture } from '../services/espnWorldCup'
import type { RealMatchCommentary, RealMatchData, RealMatchEvent } from '../types/realMatch'
import type { Fixture } from '../types/tournament'

const REAL_MATCH_CACHE_TTL_MS = 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

type RealMatchState = {
  matches: Record<string, RealMatchData>
  loading: Record<string, boolean>
  errors: Record<string, string | null>
  fetchMatchData: (fixture: Fixture, force?: boolean) => Promise<void>
  clearRealMatchCache: () => void
}

function isRealMatchCacheFresh(matchData: RealMatchData) {
  const fetchedAtTime = Date.parse(matchData.fetchedAt)

  if (Number.isNaN(fetchedAtTime)) {
    return false
  }

  return Date.now() - fetchedAtTime < REAL_MATCH_CACHE_TTL_MS
}

function hasLineupPlayers(matchData: RealMatchData) {
  const lineups = matchData.lineups

  return Boolean(
    lineups &&
      (lineups.homeXi.length || lineups.awayXi.length || lineups.homeSubs.length || lineups.awaySubs.length)
  )
}

function addDaysToFixtureDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return date
  }

  return new Date(Date.UTC(year, month - 1, day) + days * ONE_DAY_MS).toISOString().slice(0, 10)
}

function getEspnLookupFixture(fixture: Fixture): Fixture {
  if (fixture.kickoffTimeSort !== '24:00') {
    return fixture
  }

  return {
    ...fixture,
    date: addDaysToFixtureDate(fixture.date, 1),
    kickoffTimeSort: '00:00'
  }
}

function cleanEventActorName(value: string) {
  return value
    .replace(/^\s*(goal|penalty\s*-\s*scored|own goal|yellow card|red card|second yellow card|substitution)\s*:\s*/i, '')
    .trim()
}

function getEventTypeText(event: Pick<RealMatchEvent, 'type' | 'detail'>) {
  return `${event.type ?? ''} ${event.detail ?? ''}`.toLowerCase()
}

function isGoalEvent(event: Pick<RealMatchEvent, 'type' | 'detail'>) {
  const typeText = getEventTypeText(event)
  return typeText.includes('goal') || typeText.includes('penalty - scored')
}

function isCardEvent(event: Pick<RealMatchEvent, 'type' | 'detail'>) {
  const typeText = getEventTypeText(event)
  return typeText.includes('yellow card') || typeText.includes('red card')
}

function isSubstitutionText(value: string | undefined) {
  return Boolean(value && /\bsubstitution\b/i.test(value))
}

function cleanTimelineEvent(event: RealMatchEvent): RealMatchEvent {
  const shouldCleanLabel = isGoalEvent(event) || isCardEvent(event) || isSubstitutionText(event.type) || isSubstitutionText(event.detail)

  if (!shouldCleanLabel) {
    return event
  }

  const cleanedPlayerName = event.playerName ? cleanEventActorName(event.playerName) : event.playerName
  const cleanedSecondaryPlayerName = event.secondaryPlayerName
    ? cleanEventActorName(event.secondaryPlayerName)
    : event.secondaryPlayerName
  const cleanedDisplayText = event.displayText ? cleanEventActorName(event.displayText) : event.displayText

  return {
    ...event,
    playerName: cleanedPlayerName || event.playerName,
    secondaryPlayerName: cleanedSecondaryPlayerName || event.secondaryPlayerName,
    displayText: cleanedDisplayText || cleanedPlayerName || event.displayText
  }
}

function parseSubstitutionFromText(text: string) {
  const substitutionMatch = text.match(/substitution\s*,?\s*([^.]*)?\.\s*(.+?)\s+replaces\s+(.+?)(?:\.|$)/i)

  if (!substitutionMatch) {
    return null
  }

  return {
    teamName: substitutionMatch[1]?.trim() || undefined,
    playerIn: substitutionMatch[2]?.trim(),
    playerOut: substitutionMatch[3]?.trim()
  }
}

function normalizeTeamName(value: string | undefined) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function chooseSubstitutionTeamName(matchData: RealMatchData, commentary: RealMatchCommentary, parsedTeamName?: string) {
  if (commentary.teamName) return commentary.teamName

  const parsedTeam = normalizeTeamName(parsedTeamName)
  if (!parsedTeam) return undefined

  if (normalizeTeamName(matchData.homeTeam.name).includes(parsedTeam) || parsedTeam.includes(normalizeTeamName(matchData.homeTeam.name))) {
    return matchData.homeTeam.name
  }

  if (normalizeTeamName(matchData.awayTeam.name).includes(parsedTeam) || parsedTeam.includes(normalizeTeamName(matchData.awayTeam.name))) {
    return matchData.awayTeam.name
  }

  return parsedTeamName
}

function buildSubstitutionEventKey(event: Pick<RealMatchEvent, 'timeLabel' | 'playerName' | 'secondaryPlayerName' | 'teamName'>) {
  return [event.timeLabel, event.playerName, event.secondaryPlayerName, event.teamName]
    .map((value) => String(value ?? '').toLowerCase().trim())
    .join('|')
}

function getExistingSubstitutionEventKeys(events: RealMatchEvent[]) {
  return new Set(
    events
      .filter((event) => isSubstitutionText(event.type) || isSubstitutionText(event.detail) || isSubstitutionText(event.displayText))
      .map(buildSubstitutionEventKey)
  )
}

function deriveSubstitutionEvents(matchData: RealMatchData, events: RealMatchEvent[]) {
  const existingKeys = getExistingSubstitutionEventKeys(events)
  const substitutionEvents: RealMatchEvent[] = []

  matchData.commentary?.forEach((commentary) => {
    const text = commentary.text || ''

    if (!isSubstitutionText(text) && !isSubstitutionText(commentary.type)) {
      return
    }

    const parsed = parseSubstitutionFromText(text)
    const playerIn = parsed?.playerIn || commentary.playerName
    const playerOut = parsed?.playerOut

    if (!playerIn && !playerOut) {
      return
    }

    const event: RealMatchEvent = {
      elapsed: commentary.elapsed ?? null,
      timeLabel: commentary.timeLabel,
      teamName: chooseSubstitutionTeamName(matchData, commentary, parsed?.teamName),
      playerName: playerIn ? cleanEventActorName(playerIn) : undefined,
      secondaryPlayerName: playerOut ? cleanEventActorName(playerOut) : undefined,
      type: 'Substitution',
      detail: 'Substitution',
      displayText: playerIn ? cleanEventActorName(playerIn) : 'Substitution'
    }

    const key = buildSubstitutionEventKey(event)

    if (!existingKeys.has(key)) {
      existingKeys.add(key)
      substitutionEvents.push(event)
    }
  })

  return substitutionEvents
}

function sortEventsByMinute(events: RealMatchEvent[]) {
  return [...events].sort((a, b) => {
    const aMinute = typeof a.elapsed === 'number' ? a.elapsed : Number.MAX_SAFE_INTEGER
    const bMinute = typeof b.elapsed === 'number' ? b.elapsed : Number.MAX_SAFE_INTEGER

    if (aMinute !== bMinute) return aMinute - bMinute

    return String(a.timeLabel ?? '').localeCompare(String(b.timeLabel ?? ''))
  })
}

function cleanRealMatchData(matchData: RealMatchData): RealMatchData {
  const cleanedEvents = matchData.events.map(cleanTimelineEvent)
  const substitutionEvents = deriveSubstitutionEvents(matchData, cleanedEvents)

  return {
    ...matchData,
    events: sortEventsByMinute([...cleanedEvents, ...substitutionEvents])
  }
}

export const useRealMatchStore = create<RealMatchState>()(
  persist(
    (set, get) => ({
      matches: {},
      loading: {},
      errors: {},

      fetchMatchData: async (fixture, force = false) => {
        const lookupFixture = getEspnLookupFixture(fixture)

        if (!canFetchEspnWorldCupMatchData(lookupFixture)) {
          set((state) => ({
            errors: {
              ...state.errors,
              [fixture.id]: 'ESPN World Cup data is not available for this fixture yet.'
            }
          }))
          return
        }

        const existing = get().matches[fixture.id]
        const shouldUseFreshCache = existing && hasLineupPlayers(existing)

        if (shouldUseFreshCache && !force && isRealMatchCacheFresh(existing)) {
          set((state) => ({
            errors: { ...state.errors, [fixture.id]: null }
          }))
          return
        }

        set((state) => ({
          loading: { ...state.loading, [fixture.id]: true },
          errors: { ...state.errors, [fixture.id]: null }
        }))

        try {
          const data = cleanRealMatchData(await fetchEspnWorldCupMatchDataForFixture(lookupFixture))

          set((state) => ({
            matches: { ...state.matches, [fixture.id]: data },
            loading: { ...state.loading, [fixture.id]: false },
            errors: { ...state.errors, [fixture.id]: null }
          }))
        } catch (error) {
          set((state) => ({
            loading: { ...state.loading, [fixture.id]: false },
            errors: {
              ...state.errors,
              [fixture.id]: error instanceof Error ? error.message : 'Unable to load real match data.'
            }
          }))
        }
      },

      clearRealMatchCache: () => {
        set({ matches: {}, loading: {}, errors: {} })
      }
    }),
    { name: 'world-cup-2026-real-match-cache-v8' }
  )
)
