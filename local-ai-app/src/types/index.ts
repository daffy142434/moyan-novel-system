export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoningContent?: string; // DeepSeek 思考过程
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  promptId: string | null; // 兼容旧数据
  promptIds: string[]; // 支持多个提示词
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  workingDirectory?: string; // 会话级工作目录，为空则用全局默认
  totalTokens?: number; // 该会话消耗的 token 总数
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: "deepseek" | "doubao" | "kimi" | "glm";
  apiKey: string;
  baseUrl: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  variables: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  fontSize: number;
  globalPrompt: {
    enabled: boolean;
    content: string;
  };
  language: "zh" | "en";
  accentColor: string;
  defaultDirectory?: string; // 默认工作目录
}

export type TabView = "chat" | "prompts" | "settings";
