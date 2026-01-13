import { Artifact, ArtifactStatus, DayGroup } from '@/types/artifact';
import { supabase } from './supabase';

// Database row type (snake_case from Supabase)
interface ArtifactRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  raw_content: string;
  summary: string | null;
  full_audio_text: string | null;
  source_url: string | null;
  image_data: string | null;
  status: string;
  created_at: string;
  played_at: string | null;
  completed_at: string | null;
  tags: string[];
  day_bucket: string;
}

// Convert database row to Artifact type
function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as Artifact['type'],
    title: row.title,
    rawContent: row.raw_content,
    summary: row.summary ?? undefined,
    fullAudioText: row.full_audio_text ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    imageData: row.image_data ?? undefined,
    status: row.status as ArtifactStatus,
    createdAt: row.created_at,
    playedAt: row.played_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    tags: row.tags,
    dayBucket: row.day_bucket,
  };
}

// Convert Artifact to database row format
function artifactToRow(artifact: Artifact): Omit<ArtifactRow, 'created_at'> & { created_at?: string } {
  return {
    id: artifact.id,
    user_id: artifact.userId,
    type: artifact.type,
    title: artifact.title,
    raw_content: artifact.rawContent,
    summary: artifact.summary ?? null,
    full_audio_text: artifact.fullAudioText ?? null,
    source_url: artifact.sourceUrl ?? null,
    image_data: artifact.imageData ?? null,
    status: artifact.status,
    created_at: artifact.createdAt,
    played_at: artifact.playedAt ?? null,
    completed_at: artifact.completedAt ?? null,
    tags: artifact.tags,
    day_bucket: artifact.dayBucket,
  };
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToArtifact(data as ArtifactRow);
}

export async function getAllArtifacts(userId: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as ArtifactRow[]).map(rowToArtifact);
}

export async function getArtifactsByDay(userId: string, date: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('user_id', userId)
    .eq('day_bucket', date)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as ArtifactRow[]).map(rowToArtifact);
}

export async function getArtifactsByStatus(userId: string, status: ArtifactStatus): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as ArtifactRow[]).map(rowToArtifact);
}

export async function getPendingArtifacts(userId: string): Promise<Artifact[]> {
  return getArtifactsByStatus(userId, 'ready');
}

export async function saveArtifact(artifact: Artifact): Promise<void> {
  const row = artifactToRow(artifact);
  const { error } = await supabase
    .from('artifacts')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('Error saving artifact:', error);
    throw error;
  }
}

export async function updateArtifactStatus(
  id: string,
  status: ArtifactStatus,
  additionalFields?: Partial<Artifact>
): Promise<Artifact | null> {
  // First get the current artifact
  const current = await getArtifact(id);
  if (!current) return null;

  const updates: Record<string, unknown> = { status };

  if (status === 'playing' && !current.playedAt) {
    updates.played_at = new Date().toISOString();
  }
  if (status === 'completed' && !current.completedAt) {
    updates.completed_at = new Date().toISOString();
  }

  // Add any additional fields (convert to snake_case)
  if (additionalFields) {
    if (additionalFields.summary !== undefined) updates.summary = additionalFields.summary;
    if (additionalFields.fullAudioText !== undefined) updates.full_audio_text = additionalFields.fullAudioText;
    if (additionalFields.title !== undefined) updates.title = additionalFields.title;
    if (additionalFields.tags !== undefined) updates.tags = additionalFields.tags;
  }

  const { data, error } = await supabase
    .from('artifacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return null;
  return rowToArtifact(data as ArtifactRow);
}

export async function deleteArtifact(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('artifacts')
    .delete()
    .eq('id', id);

  return !error;
}

export async function getDayGroups(userId: string): Promise<DayGroup[]> {
  const userArtifacts = await getAllArtifacts(userId);
  const groups: Map<string, Artifact[]> = new Map();

  for (const artifact of userArtifacts) {
    const existing = groups.get(artifact.dayBucket) || [];
    existing.push(artifact);
    groups.set(artifact.dayBucket, existing);
  }

  const dayGroups: DayGroup[] = [];
  for (const [date, arts] of groups) {
    dayGroups.push({
      date,
      artifacts: arts,
      stats: {
        total: arts.length,
        pending: arts.filter(a => a.status === 'pending' || a.status === 'processing').length,
        ready: arts.filter(a => a.status === 'ready').length,
        completed: arts.filter(a => a.status === 'completed').length,
      },
    });
  }

  return dayGroups.sort((a, b) => b.date.localeCompare(a.date));
}
