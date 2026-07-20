import { create } from "zustand";
import type { Conversation, Message } from "@/types";
import { generateId } from "@/lib/utils";
import { markDirty } from "@/lib/storage";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;

  // Actions
  createConversation: (modelId: string, promptId?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastMessage: (conversationId: string, content: string) => void;
  updateLastMessageReasoning: (conversationId: string, reasoning: string) => void;
  setStreaming: (streaming: boolean) => void;
  getActiveConversation: () => Conversation | undefined;
  updateConversationTitle: (id: string, title: string) => void;
  updateConversationModel: (id: string, modelId: string) => void;
  updateConversationPrompt: (id: string, promptId: string | null) => void;
  toggleConversationPrompt: (id: string, promptId: string) => void;
  updateConversationPrompts: (id: string, promptIds: string[]) => void;
  updateConversationDirectory: (id: string, dir: string) => void;
  updateConversationTokens: (id: string, tokens: number) => void;
  loadConversations: (convs: Conversation[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,

  loadConversations: (convs: Conversation[]) => {
    // Ensure backward compatibility for promptIds
    const normalized = convs.map((c) => ({
      ...c,
      promptIds: c.promptIds || (c.promptId ? [c.promptId] : []),
    }));
    set({ conversations: normalized, activeConversationId: normalized[0]?.id || null });
  },

  createConversation: (modelId: string, promptId?: string) => {
    const id = generateId();
    const promptIds = promptId ? [promptId] : [];
    const conv: Conversation = {
      id,
      title: "新对话",
      modelId,
      promptId: promptId || null,
      promptIds,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      conversations: [conv, ...state.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  deleteConversation: (id: string) => {
    set((state) => {
      const filtered = state.conversations.filter((c) => c.id !== id);
      return {
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === id
            ? filtered[0]?.id || null
            : state.activeConversationId,
      };
    });
  },

  setActiveConversation: (id: string) => {
    set({ activeConversationId: id });
  },

  addMessage: (conversationId: string, message: Message) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              updatedAt: Date.now(),
              title:
                c.title === "新对话" && message.role === "user"
                  ? message.content.slice(0, 30)
                  : c.title,
            }
          : c
      ),
    }));
  },

  updateLastMessage: (conversationId: string, content: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId && c.messages.length > 0
          ? {
              ...c,
              messages: c.messages.map((m, i) =>
                i === c.messages.length - 1 ? { ...m, content } : m
              ),
            }
          : c
      ),
    }));
  },

  updateLastMessageReasoning: (conversationId: string, reasoning: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId && c.messages.length > 0
          ? {
              ...c,
              messages: c.messages.map((m, i) =>
                i === c.messages.length - 1 ? { ...m, reasoningContent: reasoning } : m
              ),
            }
          : c
      ),
    }));
  },

  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.activeConversationId);
  },

  updateConversationTitle: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  updateConversationModel: (id: string, modelId: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, modelId } : c
      ),
    }));
  },

  updateConversationPrompt: (id: string, promptId: string | null) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, promptId } : c
      ),
    }));
  },

  toggleConversationPrompt: (id: string, promptId: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== id) return c;
        const exists = c.promptIds.includes(promptId);
        return {
          ...c,
          promptIds: exists
            ? c.promptIds.filter((p) => p !== promptId)
            : [...c.promptIds, promptId],
        };
      }),
    }));
  },

  updateConversationPrompts: (id: string, promptIds: string[]) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, promptIds } : c
      ),
    }));
  },

  updateConversationDirectory: (id: string, dir: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, workingDirectory: dir } : c
      ),
    }));
  },

  updateConversationTokens: (id: string, tokens: number) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, totalTokens: (c.totalTokens || 0) + tokens } : c
      ),
    }));
  },
}));

// Auto-persist conversations
useChatStore.subscribe(() => markDirty("conversations"));
