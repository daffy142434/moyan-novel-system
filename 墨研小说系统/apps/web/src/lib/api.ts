import type {
  AuthResponseDto,
  BuildStageKey,
  CreationSessionDto,
  DashboardDto,
  ProductDefinitionDto,
  ProductType,
  StudioGenerationInputDto,
  StudioGenerationRunDto,
  StudioProjectDto,
} from '@moyan/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100/api';
const TOKEN_KEY = 'moyan_access_token';
const USER_KEY = 'moyan_user';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function token() {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = token();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.code ?? body?.message?.code ?? `HTTP_${response.status}`;
    const detail = body?.message?.message ?? body?.message ?? body?.error ?? '请求失败';
    throw new ApiError(response.status, code, typeof detail === 'string' ? detail : code);
  }
  return body as T;
}

export const session = {
  save(auth: AuthResponseDto) {
    localStorage.setItem(TOKEN_KEY, auth.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  hasToken() {
    return Boolean(token());
  },
  user() {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthResponseDto['user'] | null;
    } catch {
      return null;
    }
  },
};

export const api = {
  register: (input: { email: string; password: string; displayName: string }) =>
    request<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  products: () => request<ProductDefinitionDto[]>('/studio/products'),
  dashboard: () => request<DashboardDto>('/studio/dashboard'),
  studioProjects: () => request<StudioProjectDto[]>('/studio/projects'),
  studioProject: (projectId: string) => request<StudioProjectDto>(`/studio/projects/${projectId}`),
  deleteStudioProject: (projectId: string) =>
    request<{ deleted: boolean; id: string }>(`/studio/projects/${projectId}`, { method: 'DELETE' }),
  createSession: (productType: ProductType) =>
    request<CreationSessionDto>('/studio/creation-sessions', {
      method: 'POST', body: JSON.stringify({ productType }),
    }),
  updateSession: (sessionId: string, input: { selections?: Record<string, unknown>; selectedTitle?: string; proposalContent?: string }) =>
    request<CreationSessionDto>(`/studio/creation-sessions/${sessionId}`, {
      method: 'PUT', body: JSON.stringify(input),
    }),
  confirmSession: (sessionId: string, selectedTitle: string) =>
    request<StudioProjectDto>(`/studio/creation-sessions/${sessionId}/confirm`, {
      method: 'POST', body: JSON.stringify({ selectedTitle }),
    }),
  saveBuild: (projectId: string, stage: BuildStageKey, content: string, summary = '') =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/build/${stage}`, {
      method: 'PUT', body: JSON.stringify({ content, summary }),
    }),
  confirmBuild: (projectId: string, stage: BuildStageKey) =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/build/${stage}/confirm`, { method: 'POST' }),
  rewindBuild: (projectId: string, stage: BuildStageKey) =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/build/${stage}/rewind`, { method: 'POST' }),
  saveEpisode: (projectId: string, number: number, content: string, title?: string) =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/episodes/${number}`, {
      method: 'PUT', body: JSON.stringify({ content, title }),
    }),
  addAnnotation: (projectId: string, number: number, input: {
    startOffset: number; endOffset: number; quotedText: string; note: string;
  }) => request<StudioProjectDto>(`/studio/projects/${projectId}/episodes/${number}/annotations`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  deleteAnnotation: (projectId: string, number: number, annotationId: string) =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/episodes/${number}/annotations/${annotationId}`, {
      method: 'DELETE',
    }),
  confirmEpisode: (projectId: string, number: number) =>
    request<StudioProjectDto>(`/studio/projects/${projectId}/episodes/${number}/confirm`, { method: 'POST' }),
  startStudioGeneration: (input: StudioGenerationInputDto) =>
    request<StudioGenerationRunDto>('/studio/generation-runs', { method: 'POST', body: JSON.stringify(input) }),
  cancelStudioGeneration: (runId: string) =>
    request<{ cancelled: boolean }>(`/studio/generation-runs/${runId}/cancel`, { method: 'POST' }),
};

export async function streamStudioGeneration(
  input: StudioGenerationInputDto,
  onUpdate: (run: StudioGenerationRunDto) => void,
) {
  let run = await api.startStudioGeneration(input);
  onUpdate(run);
  const response = await fetch(`${API_URL}/studio/generation-runs/${run.id}/events`, {
    headers: { Authorization: `Bearer ${token() ?? ''}` },
  });
  if (!response.ok || !response.body) throw new ApiError(response.status, 'GENERATION_STREAM_FAILED', '无法建立生成流');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = block.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
      const raw = block.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!event || !raw) continue;
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (event === 'run.started') run = { ...run, ...data };
      if (event === 'reasoning.delta') run = { ...run, status: 'streaming', reasoning: run.reasoning + String(data.delta ?? '') };
      if (event === 'content.delta') run = { ...run, status: 'streaming', content: run.content + String(data.delta ?? '') };
      if (event === 'run.completed') run = { ...run, status: 'completed', result: data.result };
      if (event === 'run.cancelled') run = { ...run, status: 'cancelled' };
      if (event === 'run.failed') run = {
        ...run,
        status: 'failed',
        errorCode: String(data.code ?? data.errorCode ?? ''),
        errorMessage: String(data.message ?? data.errorMessage ?? ''),
      };
      onUpdate(run);
    }
    if (done) break;
  }
  if (run.status === 'failed') throw new ApiError(500, run.errorCode ?? 'GENERATION_FAILED', run.errorMessage ?? '生成失败');
  return run;
}

export function readableError(error: unknown) {
  if (error instanceof ApiError) {
    const known: Record<string, string> = {
      INVALID_CREDENTIALS: '邮箱或密码不正确',
      EMAIL_ALREADY_REGISTERED: '该邮箱已经注册',
      DEEPSEEK_NOT_CONFIGURED: '服务端尚未配置 DeepSeek 密钥',
      STEP_DEPENDENCY_NOT_CONFIRMED: '请先确认上一个创作步骤',
    };
    return known[error.code] ?? `${error.message}（${error.code}）`;
  }
  return error instanceof Error ? error.message : '发生未知错误';
}
