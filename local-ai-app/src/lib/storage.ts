/**
 * 持久化存储层
 * - Electron 环境: 通过 IPC 写入 userData/app-data.json
 * - 浏览器环境: 写入 localStorage
 */

const KEY = "local-ai-app-data";

type StoreData = {
  conversations: any[];
  prompts: any[];
  models: any[];
  settings: any;
};

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

// ====== 加载 ======
export async function loadPersistedData(): Promise<Partial<StoreData>> {
  if (isElectron()) {
    try {
      const data = await window.electronAPI.storeGet("all");
      if (data) return data;
    } catch (e) {
      console.error("Failed to load from Electron store:", e);
    }
  }

  // Browser fallback
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {};
}

// ====== 保存全部 ======
export async function persistData(data: Partial<StoreData>): Promise<void> {
  if (isElectron()) {
    try {
      await window.electronAPI.storeSet("all", data);
      return;
    } catch (e) {
      console.error("Failed to save to Electron store:", e);
    }
  }

  // Browser fallback
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

// ====== 自动定期保存（每 3 秒） ======
const dirtyFlags = { conversations: false, prompts: false, models: false, settings: false };
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const { useChatStore } = await import("@/stores/chatStore");
    const { usePromptStore } = await import("@/stores/promptStore");
    const { useSettingsStore } = await import("@/stores/settingsStore");

    const data: StoreData = {
      conversations: useChatStore.getState().conversations,
      prompts: usePromptStore.getState().prompts,
      models: useSettingsStore.getState().models,
      settings: useSettingsStore.getState().settings,
    };
    await persistData(data);
  }, 3000);
}

export function markDirty(area: keyof typeof dirtyFlags) {
  dirtyFlags[area] = true;
  scheduleSave();
}
