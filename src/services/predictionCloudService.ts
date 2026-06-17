import { supabase } from '../lib/supabase'
import type { PredictionScore } from '../types/tournament'

type DatabasePredictionSet = {
  id: string
  user_id: string
  name: string
  is_default: boolean
  migrated_from_local_at: string | null
  last_synced_at: string | null
}

type DatabasePredictionScore = {
  fixture_id: string
  home_score: number | null
  away_score: number | null
  winner_team_id: string | null
}

export type PredictionSyncLoadResult = {
  predictionSetId: string
  scores: Record<string, PredictionScore>
  migratedLocalScores: boolean
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function hasMeaningfulScore(score: PredictionScore | undefined) {
  return Boolean(
    score &&
      (typeof score.homeScore === 'number' ||
        typeof score.awayScore === 'number' ||
        Boolean(score.winnerTeamId))
  )
}

function compactScores(scores: Record<string, PredictionScore>) {
  return Object.entries(scores).reduce<Record<string, PredictionScore>>((map, [fixtureId, score]) => {
    if (hasMeaningfulScore(score)) {
      map[fixtureId] = {
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        ...(score.winnerTeamId ? { winnerTeamId: score.winnerTeamId } : {})
      }
    }

    return map
  }, {})
}

async function ensureUserProfile(userId: string, email?: string) {
  const client = requireSupabase()

  const { error } = await client.from('user_profiles').upsert(
    {
      id: userId,
      email: email ?? null,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: 'id'
    }
  )

  if (error) {
    throw error
  }
}

async function getDefaultPredictionSet(userId: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('prediction_sets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    return data as DatabasePredictionSet
  }

  const { data: inserted, error: insertError } = await client
    .from('prediction_sets')
    .insert({
      user_id: userId,
      name: 'Default predictions',
      is_default: true
    })
    .select('*')
    .single()

  if (insertError) {
    const { data: existing, error: existingError } = await client
      .from('prediction_sets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single()

    if (existingError) {
      throw insertError
    }

    return existing as DatabasePredictionSet
  }

  return inserted as DatabasePredictionSet
}

export async function loadCloudPredictionScores(predictionSetId: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('prediction_scores')
    .select('fixture_id, home_score, away_score, winner_team_id')
    .eq('prediction_set_id', predictionSetId)

  if (error) {
    throw error
  }

  return ((data ?? []) as DatabasePredictionScore[]).reduce<Record<string, PredictionScore>>(
    (map, row) => {
      map[row.fixture_id] = {
        homeScore: row.home_score,
        awayScore: row.away_score,
        ...(row.winner_team_id ? { winnerTeamId: row.winner_team_id } : {})
      }

      return map
    },
    {}
  )
}

export async function savePredictionScores(
  predictionSetId: string,
  userId: string,
  scores: Record<string, PredictionScore>
) {
  const client = requireSupabase()
  const compactedScores = compactScores(scores)

  const { error: deleteError } = await client
    .from('prediction_scores')
    .delete()
    .eq('prediction_set_id', predictionSetId)
    .eq('user_id', userId)

  if (deleteError) {
    throw deleteError
  }

  const rows = Object.entries(compactedScores).map(([fixtureId, score]) => ({
    prediction_set_id: predictionSetId,
    user_id: userId,
    fixture_id: fixtureId,
    home_score: score.homeScore,
    away_score: score.awayScore,
    winner_team_id: score.winnerTeamId ?? null
  }))

  if (rows.length > 0) {
    const { error: insertError } = await client.from('prediction_scores').insert(rows)

    if (insertError) {
      throw insertError
    }
  }

  const { error: updateError } = await client
    .from('prediction_sets')
    .update({
      last_synced_at: new Date().toISOString()
    })
    .eq('id', predictionSetId)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }
}

async function markLocalMigrationComplete(predictionSetId: string, userId: string) {
  const client = requireSupabase()
  const timestamp = new Date().toISOString()

  const { error } = await client
    .from('prediction_sets')
    .update({
      migrated_from_local_at: timestamp,
      last_synced_at: timestamp
    })
    .eq('id', predictionSetId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  const { error: profileError } = await client
    .from('user_profiles')
    .update({
      migration_completed_at: timestamp
    })
    .eq('id', userId)

  if (profileError) {
    throw profileError
  }
}

export async function loadAndMigrateUserPredictions(
  userId: string,
  email: string | undefined,
  localScores: Record<string, PredictionScore>
): Promise<PredictionSyncLoadResult> {
  await ensureUserProfile(userId, email)

  const predictionSet = await getDefaultPredictionSet(userId)
  const cloudScores = await loadCloudPredictionScores(predictionSet.id)
  const compactedLocalScores = compactScores(localScores)
  const hasLocalScores = Object.keys(compactedLocalScores).length > 0

  if (!predictionSet.migrated_from_local_at && hasLocalScores) {
    const mergedScores = {
      ...cloudScores,
      ...compactedLocalScores
    }

    await savePredictionScores(predictionSet.id, userId, mergedScores)
    await markLocalMigrationComplete(predictionSet.id, userId)

    return {
      predictionSetId: predictionSet.id,
      scores: mergedScores,
      migratedLocalScores: true
    }
  }

  return {
    predictionSetId: predictionSet.id,
    scores: cloudScores,
    migratedLocalScores: false
  }
}
