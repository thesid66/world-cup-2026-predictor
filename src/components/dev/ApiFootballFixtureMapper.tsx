import { Clipboard, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { fixtures } from '../../data/fixtures'
import { teams } from '../../data/teams'
import {
  fetchApiFootballWorldCup2026Fixtures,
  type ApiFootballWorldCupFixture
} from '../../services/apiFootball'
import {
  generateApiFootballFixtureIdMapCode,
  mapApiFootballFixtures
} from '../../logic/mapApiFootballFixtures'

export function ApiFootballFixtureMapper() {
  const [apiFixtures, setApiFixtures] = useState<ApiFootballWorldCupFixture[]>([])
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupFixtures = fixtures.filter((fixture) => fixture.stage === 'group')

  const mappingResults = apiFixtures.length
    ? mapApiFootballFixtures({
        localFixtures: groupFixtures,
        apiFixtures,
        teams
      })
    : []

  const exactCount = mappingResults.filter((result) => result.confidence === 'exact').length

  const swappedCount = mappingResults.filter((result) => result.confidence === 'swapped').length

  const unmatchedCount = mappingResults.filter((result) => result.confidence === 'unmatched').length

  async function handleFetchAndMap() {
    setLoading(true)
    setError(null)
    setCopied(false)

    try {
      const fetchedFixtures = await fetchApiFootballWorldCup2026Fixtures()

      setApiFixtures(fetchedFixtures)

      const results = mapApiFootballFixtures({
        localFixtures: groupFixtures,
        apiFixtures: fetchedFixtures,
        teams
      })

      setGeneratedCode(generateApiFootballFixtureIdMapCode(results))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to fetch API-Football fixtures.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!generatedCode) {
      return
    }

    await navigator.clipboard.writeText(generatedCode)
    setCopied(true)
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-sky-300">
            Developer helper
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">API-Football fixture mapper</h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Fetch World Cup 2026 fixtures from API-Football and generate a local fixture ID mapping
            for real scores and match stats.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFetchAndMap}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/30 bg-sky-300/10 px-5 py-3 text-sm font-black text-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Fetching...' : 'Fetch and generate map'}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">
            API-Football error
          </p>

          <p className="mt-2 text-sm font-bold leading-6 text-red-100">{error}</p>

          {error.toLowerCase().includes('free plans') && (
            <p className="mt-3 text-sm font-bold leading-6 text-yellow-100">
              Your API key is working, but your current free plan cannot access the 2026 season. You
              can keep using local fixture data for now, then map API fixture IDs later when your
              plan supports World Cup 2026 data.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            API fixtures
          </p>
          <p className="mt-1 text-3xl font-black text-white">{apiFixtures.length}</p>
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Exact</p>
          <p className="mt-1 text-3xl font-black text-white">{exactCount}</p>
        </div>

        <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-200">Swapped</p>
          <p className="mt-1 text-3xl font-black text-white">{swappedCount}</p>
        </div>

        <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Unmatched</p>
          <p className="mt-1 text-3xl font-black text-white">{unmatchedCount}</p>
        </div>
      </div>

      {generatedCode && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-white">Generated mapping code</h3>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/15"
            >
              <Clipboard className="size-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <pre className="max-h-96 overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
            <code>{generatedCode}</code>
          </pre>

          <p className="mt-3 text-sm font-bold text-slate-400">
            Paste this into{' '}
            <code className="font-black text-yellow-200">src/data/apiFootballFixtureIds.ts</code>.
          </p>
        </div>
      )}

      {mappingResults.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-white/10 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-3 py-3">Local</th>
                <th className="px-3 py-3">API Fixture</th>
                <th className="px-3 py-3">Round</th>
                <th className="px-3 py-3">Confidence</th>
                <th className="px-3 py-3">Reason</th>
              </tr>
            </thead>

            <tbody>
              {mappingResults.map((result) => {
                const statusClass =
                  result.confidence === 'exact'
                    ? 'text-emerald-200'
                    : result.confidence === 'swapped'
                      ? 'text-yellow-200'
                      : 'text-red-200'

                return (
                  <tr
                    key={result.localFixture.id}
                    className="border-t border-white/10 bg-slate-950/35"
                  >
                    <td className="px-3 py-3 font-bold text-white">
                      Match {result.localFixture.matchNumber}
                      <p className="text-xs text-slate-500">
                        {result.localFixture.homeTeamId} vs {result.localFixture.awayTeamId}
                      </p>
                    </td>

                    <td className="px-3 py-3 font-bold text-slate-300">
                      {result.apiFixture
                        ? `${result.apiFixture.fixture.id} · ${result.apiFixture.teams.home.name} vs ${result.apiFixture.teams.away.name}`
                        : 'No match'}
                    </td>

                    <td className="px-3 py-3 text-slate-400">
                      {result.apiFixture?.league.round ?? '-'}
                    </td>

                    <td className={`px-3 py-3 font-black ${statusClass}`}>{result.confidence}</td>

                    <td className="px-3 py-3 text-slate-400">{result.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
