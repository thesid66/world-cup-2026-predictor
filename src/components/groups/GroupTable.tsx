import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Fixture, GroupTableRow, PredictionScore, Team } from '../../types/tournament'
import { TeamFlag } from '../ui/TeamFlag'

type GroupTableProps = {
  rows: GroupTableRow[]
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
  teams: Team[]
}

type TeamMatchSummary = {
  id: string
  matchNumber: number
  opponentName: string
  opponentShortName: string
  opponentFlagCode: string
  scoreLabel: string
  result: 'win' | 'loss' | 'draw'
  resultLabel: string
}

function isDirectQualified(row: GroupTableRow) {
  return row.directQualificationStatus === 'qualified'
}

function getRankStyle(index: number, qualified = false) {
  if (qualified) {
    return 'bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-300/20'
  }

  if (index <= 1) {
    return 'bg-emerald-300 text-emerald-950'
  }

  if (index === 2) {
    return 'bg-yellow-300 text-yellow-950'
  }

  return 'bg-red-300/20 text-red-200'
}

function getRankMarker(index: number, qualified = false) {
  return qualified ? 'Q' : index + 1
}

function getStatusLabel(index: number, qualified = false) {
  if (qualified) return 'Qualified'
  if (index <= 1) return 'Qualify'
  if (index === 2) return 'Third race'

  return 'Out'
}

function getStatusClass(index: number, qualified = false) {
  if (qualified) {
    return 'bg-emerald-300/15 text-emerald-100 ring-emerald-300/35'
  }

  if (index <= 1) {
    return 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20'
  }

  if (index === 2) {
    return 'bg-yellow-300/10 text-yellow-200 ring-yellow-300/20'
  }

  return 'bg-red-300/10 text-red-200 ring-red-300/20'
}

function getRowClass(row: GroupTableRow) {
  if (isDirectQualified(row)) {
    return 'border-emerald-300/25 bg-emerald-300/10 shadow-lg shadow-emerald-950/20'
  }

  return 'border-white/10 bg-slate-950/45'
}

function getResultClass(result: TeamMatchSummary['result']) {
  if (result === 'win') return 'bg-emerald-300/15 text-emerald-100 ring-emerald-300/30'
  if (result === 'loss') return 'bg-red-300/15 text-red-100 ring-red-300/30'

  return 'bg-yellow-300/12 text-yellow-100 ring-yellow-300/25'
}

function getToggleLabel(teamName: string, expanded: boolean) {
  return `${expanded ? 'Hide' : 'Show'} group-stage matches for ${teamName}`
}

function MatchToggleChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-300/10 text-yellow-300 ring-1 ring-yellow-300/20 transition duration-200 ${
        expanded ? 'rotate-180' : ''
      }`}
      aria-hidden="true"
    >
      <ChevronDown className="size-4" strokeWidth={3} />
    </span>
  )
}

function getTeamMatchSummaries(args: {
  row: GroupTableRow
  fixtures: Fixture[]
  scores: Record<string, PredictionScore>
  teamsById: Map<string, Team>
}): TeamMatchSummary[] {
  const { row, fixtures, scores, teamsById } = args

  return fixtures
    .filter((fixture) => fixture.stage === 'group')
    .filter((fixture) => fixture.homeTeamId === row.teamId || fixture.awayTeamId === row.teamId)
    .map((fixture) => {
      const score = scores[fixture.id]

      if (typeof score?.homeScore !== 'number' || typeof score?.awayScore !== 'number') {
        return null
      }

      const isHomeTeam = fixture.homeTeamId === row.teamId
      const opponentId = isHomeTeam ? fixture.awayTeamId : fixture.homeTeamId
      const opponent = teamsById.get(opponentId)

      if (!opponent) return null

      const teamScore = isHomeTeam ? score.homeScore : score.awayScore
      const opponentScore = isHomeTeam ? score.awayScore : score.homeScore
      const result = teamScore > opponentScore ? 'win' : teamScore < opponentScore ? 'loss' : 'draw'
      const resultLabel = result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Draw'

      return {
        id: fixture.id,
        matchNumber: fixture.matchNumber,
        opponentName: opponent.name,
        opponentShortName: opponent.shortName,
        opponentFlagCode: opponent.flagCode,
        scoreLabel: `${row.shortName} ${teamScore}-${opponentScore} ${opponent.shortName}`,
        result,
        resultLabel
      }
    })
    .filter((match): match is TeamMatchSummary => Boolean(match))
    .sort((a, b) => a.matchNumber - b.matchNumber)
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/6 px-2 py-2 text-center ring-1 ring-white/8">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function MatchesPanel({ matches, teamName }: { matches: TeamMatchSummary[]; teamName: string }) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-bold text-slate-400">
        No completed group-stage matches for {teamName} yet.
      </div>
    )
  }

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {matches.map((match) => (
        <article
          key={match.id}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 shadow-lg shadow-slate-950/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <TeamFlag code={match.opponentFlagCode} label={match.opponentName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">vs {match.opponentName}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Match {match.matchNumber}
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ring-1 ${getResultClass(
                match.result
              )}`}
            >
              {match.resultLabel}
            </span>
          </div>

          <p className="mt-3 rounded-xl bg-slate-950/60 px-3 py-2 text-center text-sm font-black text-white ring-1 ring-white/8">
            {match.scoreLabel}
          </p>
        </article>
      ))}
    </div>
  )
}

export function GroupTable({ rows, fixtures, scores, teams }: GroupTableProps) {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const teamsById = new Map(teams.map((team) => [team.id, team]))

  function toggleTeam(teamId: string) {
    setExpandedTeamId((currentTeamId) => (currentTeamId === teamId ? null : teamId))
  }

  return (
    <>
      <div className="grid gap-3 sm:hidden">
        {rows.map((row, index) => {
          const qualified = isDirectQualified(row)
          const expanded = expandedTeamId === row.teamId
          const matches = getTeamMatchSummaries({ row, fixtures, scores, teamsById })

          return (
            <article key={row.teamId} className={`rounded-2xl border p-3 ${getRowClass(row)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${getRankStyle(
                      index,
                      qualified
                    )}`}
                  >
                    {getRankMarker(index, qualified)}
                  </span>

                  <TeamFlag code={row.flagCode} label={row.teamName} />

                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{row.teamName}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-black text-slate-500">{row.shortName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${getStatusClass(
                          index,
                          qualified
                        )}`}
                      >
                        {getStatusLabel(index, qualified)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-yellow-200">Pts</p>
                  <p className="text-lg font-black text-yellow-300">{row.points}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                <MiniStat label="P" value={row.played} />
                <MiniStat label="W" value={row.won} />
                <MiniStat label="D" value={row.drawn} />
                <MiniStat label="L" value={row.lost} />
                <MiniStat label="GD" value={row.goalDifference} />
              </div>

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left text-xs font-black text-slate-300 transition hover:border-white/20 hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-yellow-300/40"
                aria-expanded={expanded}
                aria-label={getToggleLabel(row.teamName, expanded)}
                onClick={() => toggleTeam(row.teamId)}
              >
                <span>{matches.length} group match{matches.length === 1 ? '' : 'es'}</span>
                <MatchToggleChevron expanded={expanded} />
              </button>

              {expanded && (
                <div className="mt-3">
                  <MatchesPanel matches={matches} teamName={row.teamName} />
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="bg-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-2 py-3 text-center">P</th>
              <th className="px-2 py-3 text-center">W</th>
              <th className="px-2 py-3 text-center">D</th>
              <th className="px-2 py-3 text-center">L</th>
              <th className="px-2 py-3 text-center">GD</th>
              <th className="px-3 py-3 text-center">Pts</th>
              <th className="px-3 py-3 text-center">Matches</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const qualified = isDirectQualified(row)
              const expanded = expandedTeamId === row.teamId
              const matches = getTeamMatchSummaries({ row, fixtures, scores, teamsById })

              return (
                <Fragment key={row.teamId}>
                  <tr
                    className={`border-t transition hover:bg-white/5 ${
                      qualified
                        ? 'border-emerald-300/20 bg-emerald-300/10'
                        : 'border-white/10 bg-slate-950/35'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${getRankStyle(
                          index,
                          qualified
                        )}`}
                      >
                        {getRankMarker(index, qualified)}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <TeamFlag code={row.flagCode} label={row.teamName} />

                        <div>
                          <p className="font-black text-white">{row.teamName}</p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-black text-slate-500">{row.shortName}</p>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${getStatusClass(
                                index,
                                qualified
                              )}`}
                            >
                              {getStatusLabel(index, qualified)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-2 py-3 text-center font-bold text-slate-300">{row.played}</td>

                    <td className="px-2 py-3 text-center font-bold text-slate-300">{row.won}</td>

                    <td className="px-2 py-3 text-center font-bold text-slate-300">{row.drawn}</td>

                    <td className="px-2 py-3 text-center font-bold text-slate-300">{row.lost}</td>

                    <td className="px-2 py-3 text-center font-bold text-slate-300">
                      {row.goalDifference}
                    </td>

                    <td className="px-3 py-3 text-center text-lg font-black text-yellow-300">
                      {row.points}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/6 text-yellow-300 transition hover:border-yellow-300/40 hover:bg-yellow-300/10 focus:outline-none focus:ring-2 focus:ring-yellow-300/40"
                        aria-expanded={expanded}
                        aria-label={getToggleLabel(row.teamName, expanded)}
                        onClick={() => toggleTeam(row.teamId)}
                      >
                        <MatchToggleChevron expanded={expanded} />
                      </button>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="border-t border-white/10 bg-slate-950/60">
                      <td colSpan={9} className="px-4 py-4">
                        <MatchesPanel matches={matches} teamName={row.teamName} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
