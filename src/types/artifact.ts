export type ArtifactType = 'idea' | 'article' | 'question' | 'screenshot' | 'note';

export type ArtifactStatus = 'pending' | 'processing' | 'ready' | 'playing' | 'completed';

export interface Artifact {
  id: string;
  userId: string;
  type: ArtifactType;
  title: string;
  rawContent: string;
  summary?: string;
  fullAudioText?: string;
  sourceUrl?: string;
  imageData?: string; // base64 for screenshots
  status: ArtifactStatus;
  createdAt: string;
  playedAt?: string;
  completedAt?: string;
  tags: string[];
  dayBucket: string; // YYYY-MM-DD format for daily grouping
}

export interface CreateArtifactInput {
  type: ArtifactType;
  content: string;
  title?: string;
  sourceUrl?: string;
  imageData?: string;
  tags?: string[];
}

export interface DayGroup {
  date: string;
  artifacts: Artifact[];
  stats: {
    total: number;
    pending: number;
    ready: number;
    completed: number;
  };
}

export interface Episode {
  artifact: Artifact;
  position: number;
  total: number;
  contentMode: 'summary' | 'full';
}
