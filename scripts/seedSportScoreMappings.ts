import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

import { teams } from '../src/data/teams'
import { fixtures } from '../src/data/fixtures'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY in .env.local')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const baseUrl = 'https://sportscore.com'

const teamLookupAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'bosnia-herzegovina': 'bosnia-and-herzegovina',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo'
}

const matchSlugAliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo',
  'cabo-verde': 'cape-verde',
  'ir-iran': 'iran'
}

type SportScoreFixture = {
  home?: string
  away?: string
  time?: string
  status?: string
  competition?: string
  url?: string
}

function getArrayFromResponse(json: Record<string, unknown>) {
  for (const key of ['matches', 'fixtures', 'results', 'events', 'data']) {
    const value = json[key]
    if (Array.isArray(value)) return value as SportScoreFixture[]
  }
  return []
}

function extractMatchSlug(url: string) {
  const parts = url.split('/').filter(Boolean)
  const matchIndex = parts.indexOf('match')
  return matchIndex === -1 ? null : parts[matchIndex + 1] ?? null
}

async function fetchTeamFixtures(teamId: string) {
  const slug = teamLookupAliases[teamId] ?? teamId
  const params = new URLSearchParams({ sport: 'football', slug, limit: '30', src: 'wcpredict26' })
  const response = await fetch(`${baseUrl}/api/widget/team/?${params.toString()}`)

  if (!response.ok) {
    console.warn(`Team lookup failed: ${teamId} using ${slug} (${response.status})`)
    return []
  }

  const json = (await response.json()) as Record<string, unknown>
  return getArrayFromResponse(json).filter((row) => String(row.competition ?? '').trim() === 'FIFA World Cup')
}

function getMatchSlugTeam(teamId: string) {
  return matchSlugAliases[teamId] ?? teamId
}

async function main() {
  console.log('Fetching SportScore World Cup fixtures...')
  const sportScoreFixturesBySlug = new Map<string, SportScoreFixture>()

  for (const team of teams) {
    const rows = await fetchTeamFixtures(team.id)

    for (const row of rows) {
      if (!row.url) continue
      const slug = extractMatchSlug(row.url)
      if (slug) sportScoreFixturesBySlug.set(slug, row)
    }
  }

  console.log(`Found ${sportScoreFixturesBySlug.size} unique SportScore fixtures`)

  if (sportScoreFixturesBySlug.size !== 72) {
    throw new Error(`Expected 72 SportScore fixtures, found ${sportScoreFixturesBySlug.size}`)
  }

  const rows = fixtures.map((fixture) => {
    const home = getMatchSlugTeam(fixture.homeTeamId)
    const away = getMatchSlugTeam(fixture.awayTeamId)
    const directSlug = `${home}-vs-${away}`
    const reverseSlug = `${away}-vs-${home}`
    const matchedSlug = sportScoreFixturesBySlug.has(directSlug)
      ? directSlug
      : sportScoreFixturesBySlug.has(reverseSlug)
        ? reverseSlug
        : null

    if (!matchedSlug) {
      throw new Error(`Could not match ${fixture.id}: ${fixture.homeTeamId} vs ${fixture.awayTeamId}`)
    }

    const matchedFixture = sportScoreFixturesBySlug.get(matchedSlug)

    return {
      local_fixture_id: fixture.id,
      api_provider: 'sportscore',
      api_fixture_id: null,
      api_fixture_slug: matchedSlug,
      api_match_url: matchedFixture?.url ?? `/football/match/${matchedSlug}/`,
      confidence: 'auto-sportscore',
      notes: null
    }
  })

  const { error } = await supabase.from('api_fixture_mappings').upsert(rows, {
    onConflict: 'local_fixture_id'
  })

  if (error) throw error
  console.log(`Seeded ${rows.length} SportScore fixture mappings`)
}

main().catch((error) => {
  console.error('SportScore mapping seed failed:')
  console.error(error)
  process.exit(1)
})
