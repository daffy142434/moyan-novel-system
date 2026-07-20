import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString("zh-CN");
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

// 默认模型配置
export const DEFAULT_MODELS: ModelOption[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "deepseek" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "deepseek" },
  { id: "doubao-pro", name: "豆包 Pro", provider: "doubao" },
  { id: "doubao-lite", name: "豆包 Lite", provider: "doubao" },
  { id: "kimi-v1", name: "Kimi", provider: "kimi" },
  { id: "glm-4-plus", name: "GLM-4 Plus", provider: "glm" },
  { id: "glm-4-flash", name: "GLM-4 Flash", provider: "glm" },
];

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const DEFAULT_SETTINGS = {
  theme: "dark" as const,
  fontSize: 14,
  globalPrompt: {
    enabled: false,
    content: "",
  },
  language: "zh" as const,
  accentColor: "#1a73ff",
  defaultDirectory: "",
};

const isBrowser = typeof window !== "undefined" && !window.electronAPI;
export const PROVIDER_MAP: Record<string, { baseUrl: string }> = {
  deepseek: {
    baseUrl: isBrowser
      ? "/proxy/v1"  // Vite dev server proxy avoids CORS
      : "https://api.deepseek.com/v1",
  },
  doubao: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  kimi: { baseUrl: "https://api.moonshot.cn/v1" },
  glm: { baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
};
