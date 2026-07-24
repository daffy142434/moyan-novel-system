export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}

export const PRODUCT_TYPES = ['short_drama', 'comic_drama'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProjectLifecycleStatus =
  | 'building'
  | 'ready_to_write'
  | 'writing'
  | 'completed'
  | 'archived';
export type BuildStageKey = 'outline' | 'proposal' | 'characters' | 'catalog';
export type BuildArtifactStatus = 'available' | 'candidate' | 'confirmed' | 'locked';
export type EpisodeStatus = 'locked' | 'available' | 'draft' | 'review_required' | 'confirmed';

export interface ChoiceOptionDto {
  value: string;
  label: string;
  description: string;
  recommendation?: number;
  disabled?: boolean;
  tags?: string[];
  compatibleModes?: string[];
  channel?: 'male' | 'female' | 'all';
}

export interface ProductDefinitionDto {
  type: ProductType | string;
  title: string;
  description: string;
  enabled: boolean;
  badge?: string;
  modes: ChoiceOptionDto[];
  genres: ChoiceOptionDto[];
  visualStyles?: ChoiceOptionDto[];
  settings: {
    audiences: ChoiceOptionDto[];
    tones: ChoiceOptionDto[];
    endings: ChoiceOptionDto[];
    episodeCounts: number[];
    languages: ChoiceOptionDto[];
  };
}

export interface CreationSessionDto {
  id: string;
  productType: ProductType;
  selections: Record<string, unknown>;
  proposalContent: string;
  proposalSummary: string;
  titleOptions: string[];
  selectedTitle: string;
  expiresAt: string;
}

export interface BuildArtifactDto {
  id: string;
  stage: BuildStageKey;
  status: BuildArtifactStatus;
  version: number;
  content: string;
  summary: string;
  updatedAt: string;
}

export interface EpisodeAnnotationDto {
  id: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  note: string;
  createdAt: string;
}

export interface ReviewReportDto {
  id: string;
  score: number;
  summary: string;
  suggestions: string[];
  dimensions: Record<string, number>;
  contentVersion: number;
  createdAt: string;
}

export interface EpisodeDto {
  id: string;
  number: number;
  title: string;
  outlineSummary: string;
  status: EpisodeStatus;
  content: string;
  contentVersion: number;
  annotations: EpisodeAnnotationDto[];
  latestReview: ReviewReportDto | null;
  updatedAt: string;
}

export interface StudioProjectDto {
  id: string;
  title: string;
  productType: ProductType;
  productionMode: string;
  genre: string;
  visualStyle: string;
  audience: string;
  tone: string;
  endingType: string;
  language: string;
  episodeCount: number;
  lifecycleStatus: ProjectLifecycleStatus;
  constructionLocked: boolean;
  synopsis: string;
  settings: Record<string, unknown>;
  buildArtifacts: BuildArtifactDto[];
  episodes: EpisodeDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDto {
  projectCount: number;
  statusCounts: Record<string, number>;
  totalEpisodes: number;
  completedEpisodes: number;
  membership: {
    plan: 'free' | 'plus' | 'max';
    creditBalance: number;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    credits: number;
  };
  recentProjects: StudioProjectDto[];
}

export type StudioGenerationScope =
  | 'proposal'
  | 'build'
  | 'episode_generate'
  | 'episode_optimize'
  | 'episode_review';

export interface StudioGenerationInputDto {
  scope: StudioGenerationScope;
  sessionId?: string;
  projectId?: string;
  stage?: BuildStageKey;
  episodeNumber?: number;
  instruction?: string;
  modelId?: string;
}

export interface StudioGenerationRunDto {
  id: string;
  scope: StudioGenerationScope;
  status: 'queued' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  reasoning: string;
  content: string;
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
}
