import { create } from "zustand";
import type { PromptTemplate } from "@/types";
import { generateId } from "@/lib/utils";
import { defaultPrompts } from "@/lib/defaultPrompts";
import { markDirty } from "@/lib/storage";

interface PromptState {
  prompts: PromptTemplate[];
  selectedPromptId: string | null;

  createPrompt: (
    name: string,
    description: string,
    content: string,
    tags?: string[]
  ) => string;
  updatePrompt: (id: string, data: Partial<PromptTemplate>) => void;
  deletePrompt: (id: string) => void;
  selectPrompt: (id: string | null) => void;
  getPromptById: (id: string) => PromptTemplate | undefined;
  resetToDefaults: () => void;
  loadPrompts: (prompts: PromptTemplate[]) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [...defaultPrompts],
  selectedPromptId: null,

  loadPrompts: (prompts: PromptTemplate[]) => set({ prompts }),

  createPrompt: (name, description, content, tags = []) => {
    const id = generateId();
    const prompt: PromptTemplate = {
      id,
      name,
      description,
      content,
      tags,
      variables: extractVariables(content),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ prompts: [...state.prompts, prompt] }));
    return id;
  },

  updatePrompt: (id, data) => {
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id
          ? {
              ...p,
              ...data,
              updatedAt: Date.now(),
              variables: data.content
                ? extractVariables(data.content)
                : p.variables,
            }
          : p
      ),
    }));
  },

  deletePrompt: (id) => {
    set((state) => ({
      prompts: state.prompts.filter((p) => p.id !== id),
      selectedPromptId:
        state.selectedPromptId === id ? null : state.selectedPromptId,
    }));
  },

  selectPrompt: (id) => {
    set({ selectedPromptId: id });
  },

  getPromptById: (id) => {
    return get().prompts.find((p) => p.id === id);
  },

  resetToDefaults: () => {
    set({ prompts: [...defaultPrompts], selectedPromptId: null });
  },
}));

// Auto-persist prompts
usePromptStore.subscribe(() => markDirty("prompts"));

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}
