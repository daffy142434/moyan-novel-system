import { create } from "zustand";
import type { ModelConfig, AppSettings } from "@/types";
import { DEFAULT_SETTINGS, generateId } from "@/lib/utils";
import { markDirty } from "@/lib/storage";

interface SettingsState {
  models: ModelConfig[];
  settings: AppSettings;
  activeView: "chat" | "prompts" | "settings";

  addModel: (model: Omit<ModelConfig, "id">) => void;
  updateModel: (id: string, data: Partial<ModelConfig>) => void;
  removeModel: (id: string) => void;
  updateSettings: (data: Partial<AppSettings>) => void;
  setActiveView: (view: "chat" | "prompts" | "settings") => void;
  getModelById: (id: string) => ModelConfig | undefined;
  loadModels: (models: ModelConfig[]) => void;
  loadSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  models: [],
  settings: { ...DEFAULT_SETTINGS },
  activeView: "chat",

  addModel: (model) => {
    const id = generateId();
    set((state) => ({
      models: [...state.models, { ...model, id }],
    }));
  },

  updateModel: (id, data) => {
    set((state) => ({
      models: state.models.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
  },

  removeModel: (id) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
    }));
  },

  updateSettings: (data) => {
    set((state) => ({
      settings: { ...state.settings, ...data },
    }));
  },

  setActiveView: (view) => {
    set({ activeView: view });
  },

  getModelById: (id) => {
    return get().models.find((m) => m.id === id);
  },

  // Expose for persistence loading
  loadModels: (models: ModelConfig[]) => set({ models }),
  loadSettings: (settings: AppSettings) => set({ settings }),
}));

// Auto-persist models and settings
useSettingsStore.subscribe(() => markDirty("models"));
useSettingsStore.subscribe(() => markDirty("settings"));
