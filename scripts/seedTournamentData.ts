import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

import { teams } from '../src/data/teams'
import { groups } from '../src/data/groups'
import { fixtures } from '../src/data/fixtures'
import { apiFootballFixtureIdMap } from '../src/data/apiFootballFixtureIds'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function upsertGroups() {
  const rows = groups.map((group, index) => ({
    id: group.code,
    name: group.name,
    sort_order: index + 1
  }))

  const { error } = await supabase.from('groups').upsert(rows, {
    onConflict: 'id'
  })

  if (error) {
    throw error
  }

  console.log(`Seeded ${rows.length} groups`)
}

async function upsertTeams() {
  const rows = teams.map((team) => ({
    id: team.id,
    name: team.name,
    short_name: team.shortName,
    flag_code: team.flagCode,
    confederation: team.confederation,
    group_code: team.group
  }))

  const { error } = await supabase.from('teams').upsert(rows, {
    onConflict: 'id'
  })

  if (error) {
    throw error
  }

  console.log(`Seeded ${rows.length} teams`)
}

async function upsertFixtures() {
  const rows = fixtures.map((fixture) => ({
    id: fixture.id,
    match_number: fixture.matchNumber,
    stage: fixture.stage,
    group_code: fixture.group ?? null,
    date: fixture.date,
    kickoff_time: fixture.kickoffTime ?? '',
    kickoff_time_sort: fixture.kickoffTimeSort ?? '',
    venue: fixture.venue,
    city: fixture.city,
    home_team_id: fixture.homeTeamId,
    away_team_id: fixture.awayTeamId
  }))

  const { error } = await supabase.from('fixtures').upsert(rows, {
    onConflict: 'id'
  })

  if (error) {
    throw error
  }

  console.log(`Seeded ${rows.length} fixtures`)
}

async function upsertApiFixtureMappings() {
  const rows = Object.entries(apiFootballFixtureIdMap).map(([localFixtureId, apiFixtureId]) => ({
    local_fixture_id: localFixtureId,
    api_provider: 'api-football',
    api_fixture_id: apiFixtureId,
    confidence: 'manual',
    notes: null
  }))

  const { error } = await supabase.from('api_fixture_mappings').upsert(rows, {
    onConflict: 'local_fixture_id'
  })

  if (error) {
    throw error
  }

  console.log(`Seeded ${rows.length} API fixture mappings`)
}

async function main() {
  console.log('Seeding tournament data...')

  await upsertGroups()
  await upsertTeams()
  await upsertFixtures()
  await upsertApiFixtureMappings()

  console.log('Tournament data seed completed.')
}

main().catch((error) => {
  console.error('Seed failed:')
  console.error(error)
  process.exit(1)
})
