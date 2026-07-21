import type { AuthResponseDto, GenerationRunDto, ProjectDto, ShortNovelStepKey } from '@moyan/contracts';

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

export interface PromptDto {
  stepKey: ShortNovelStepKey;
  skillVersion: string;
  basePrompt: string;
  content: string;
  version: number;
}

export const api = {
  register: (input: { email: string; password: string; displayName: string }) =>
    request<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  listProjects: () => request<ProjectDto[]>('/projects'),
  createProject: (input: { title: string; genre: string; coreIdea: string; coreConflict: string; tone: string }) =>
    request<ProjectDto>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  getProject: (projectId: string) => request<ProjectDto>(`/projects/${projectId}`),
  getPrompt: (projectId: string, stepKey: ShortNovelStepKey) =>
    request<PromptDto>(`/projects/${projectId}/steps/${stepKey}/prompt`),
  updatePrompt: (projectId: string, stepKey: ShortNovelStepKey, content: string) =>
    request<{ stepKey: ShortNovelStepKey; content: string; version: number }>(
      `/projects/${projectId}/steps/${stepKey}/prompt`,
      { method: 'PUT', body: JSON.stringify({ content }) },
    ),
  createRun: (projectId: string, input: { stepKey: ShortNovelStepKey; instruction: string; idempotencyKey: string }) =>
    request<GenerationRunDto>(`/projects/${projectId}/generation-runs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getRun: (runId: string) => request<GenerationRunDto>(`/generation-runs/${runId}`),
  cancelRun: (runId: string) =>
    request<{ cancelled: boolean }>(`/generation-runs/${runId}/cancel`, { method: 'POST' }),
  confirmVersion: (projectId: string, stepKey: ShortNovelStepKey, versionId: string) =>
    request<ProjectDto>(`/projects/${projectId}/steps/${stepKey}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    }),
};

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
