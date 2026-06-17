import { teams } from '../src/data/teams'

const aliases: Record<string, string> = {
  'korea-republic': 'south-korea',
  'bosnia-herzegovina': 'bosnia-and-herzegovina',
  'united-states': 'usa',
  'congo-dr': 'democratic-republic-of-the-congo'
}

type Row = {
  competition?: string
  url?: string
}

function getRows(json: Record<string, unknown>) {
  const value = json.matches ?? json.fixtures ?? json.results ?? json.data
  return Array.isArray(value) ? (value as Row[]) : []
}

function getSlug(url: string) {
  return url.split('/').filter(Boolean).at(-1) ?? ''
}

async function getTeamRows(teamId: string) {
  const slug = aliases[teamId] ?? teamId
  const url = `https://sportscore.com/api/widget/team/?sport=football&slug=${slug}&limit=30&src=wcpredict26`
  const response = await fetch(url)

  if (!response.ok) {
    console.log(`Team ${teamId}: ${response.status}`)
    return []
  }

  const json = (await response.json()) as Record<string, unknown>
  const rows = getRows(json).filter((row) => row.competition === 'FIFA World Cup')
  console.log(`Team ${teamId}: ${rows.length}`)

  return rows
}

async function main() {
  const urls = new Set<string>()

  for (const team of teams) {
    const rows = await getTeamRows(team.id)
    rows.forEach((row) => {
      if (row.url) urls.add(row.url)
    })
  }

  console.log(`Unique World Cup match URLs found: ${urls.size}`)

  const firstUrl = [...urls][0]
  const firstSlug = firstUrl ? getSlug(firstUrl) : ''

  if (firstSlug) {
    const response = await fetch(`https://sportscore.com/api/widget/match/?sport=football&slug=${firstSlug}&src=wcpredict26`)
    console.log(`Match detail test: ${firstSlug}`)
    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log(JSON.stringify(await response.json(), null, 2).slice(0, 1500))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
