export {};

declare global {
  interface Window {
    electronAPI: {
      chatComplete: (params: {
        messages: { role: string; content: string }[];
        modelId: string;
        apiKey: string;
        baseUrl: string;
        temperature: number;
        maxTokens: number;
      }) => Promise<string>;

      chatStream: (params: {
        messages: { role: string; content: string }[];
        modelId: string;
        apiKey: string;
        baseUrl: string;
        temperature: number;
        maxTokens: number;
      }) => Promise<string>;

      onStreamChunk: (callback: (chunk: string) => void) => () => void;
      onStreamDone: (callback: (result: string) => void) => () => void;
      onStreamError: (callback: (error: string) => void) => () => void;
      onMenuNewConversation: (callback: () => void) => void;

      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<boolean>;

      selectDirectory: () => Promise<string | null>;

      checkDangerous: (command: string) => Promise<{ dangerous: boolean; message?: string }>;
      fileList: (baseDir: string, subPath?: string) => Promise<{ ok: boolean; files?: any[]; currentPath?: string; error?: string }>;
      fileRead: (baseDir: string, filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>;
      fileWrite: (baseDir: string, filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
      fileDelete: (baseDir: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;

      sendNotification: (title: string, body: string) => Promise<boolean>;
    };
  }
}
