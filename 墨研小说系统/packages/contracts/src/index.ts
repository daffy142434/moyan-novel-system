export const SHORT_NOVEL_STEPS = [
  'outline',
  'characters',
  'chapter_index',
  'chapter_1',
  'chapter_2',
  'chapter_3',
  'chapter_4',
  'chapter_5',
] as const;

export type ShortNovelStepKey = (typeof SHORT_NOVEL_STEPS)[number];

export type StepStatus =
  | 'not_started'
  | 'available'
  | 'editing'
  | 'generating'
  | 'awaiting_confirmation'
  | 'completed'
  | 'needs_review'
  | 'failed'
  | 'interrupted';

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}

export interface ProjectStepDto {
  key: ShortNovelStepKey;
  position: number;
  status: StepStatus;
  confirmedVersionId: string | null;
}

export interface ArtifactVersionDto {
  id: string;
  artifactId: string;
  logicalKey: ShortNovelStepKey;
  version: number;
  status: 'draft' | 'candidate' | 'confirmed' | 'archived' | 'rejected';
  content: string;
  structuredData: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  title: string;
  genre: string;
  coreIdea: string;
  coreConflict: string;
  tone: string;
  creationMode: 'short_novel_five_chapter';
  currentStep: ShortNovelStepKey;
  createdAt: string;
  updatedAt: string;
  steps?: ProjectStepDto[];
  versions?: ArtifactVersionDto[];
}

export interface GenerationRunDto {
  id: string;
  projectId: string;
  stepKey: ShortNovelStepKey;
  status: string;
  candidateVersionId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  partialContent: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface GenerationEventDto {
  id: number;
  type:
    | 'run.started'
    | 'run.progress'
    | 'content.delta'
    | 'run.completed'
    | 'run.failed'
    | 'run.cancelled';
  data: Record<string, unknown>;
}
