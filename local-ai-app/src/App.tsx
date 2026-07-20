import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChatStore } from "@/stores/chatStore";
import { usePromptStore } from "@/stores/promptStore";
import { loadPersistedData } from "@/lib/storage";
import { Sidebar } from "@/components/Layout/Sidebar";
import { ChatPanel } from "@/components/Chat/ChatPanel";
import { PromptList } from "@/components/Prompts/PromptList";
import { PromptEditor } from "@/components/Prompts/PromptEditor";
import { ModelSettings } from "@/components/Settings/ModelSettings";
import { GlobalPrompt } from "@/components/Settings/GlobalPrompt";
import { Appearance } from "@/components/Settings/Appearance";
import { WorkingDirectory } from "@/components/Settings/WorkingDirectory";
import { DEFAULT_MODELS } from "@/lib/utils";

export default function App() {
  const { activeView, settings, loadModels, loadSettings } = useSettingsStore();
  const { conversations, loadConversations, createConversation } = useChatStore();
  const { loadPrompts } = usePromptStore();
  const [loaded, setLoaded] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData().then((data) => {
      if (data.conversations && data.conversations.length > 0) {
        loadConversations(data.conversations);
      }
      if (data.prompts && data.prompts.length > 0) {
        loadPrompts(data.prompts);
      }
      if (data.models) {
        loadModels(data.models);
      }
      if (data.settings) {
        loadSettings(data.settings);
      }
      setLoaded(true);
    });
  }, []);

  // Create default conversation on first launch (after persistence check)
  useEffect(() => {
    if (loaded && conversations.length === 0) {
      createConversation("deepseek-v4-flash");
    }
  }, [loaded]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
  }, [settings.theme]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontSize]);

  // Apply accent color
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", settings.accentColor);
    // Compute hover color (lighten by 15%)
    const r = parseInt(settings.accentColor.slice(1, 3), 16);
    const g = parseInt(settings.accentColor.slice(3, 5), 16);
    const b = parseInt(settings.accentColor.slice(5, 7), 16);
    const lighten = (c: number) => Math.min(255, c + Math.floor((255 - c) * 0.4));
    const hover = `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
    root.style.setProperty("--accent-hover", hover);
  }, [settings.accentColor]);

  // Always use Chinese
  useEffect(() => {
    document.documentElement.lang = "zh-CN";
  }, []);

  return (
    <div className="flex h-screen bg-app text-main">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {activeView === "chat" && <ChatPanel />}
        {activeView === "prompts" && (
          <div className="flex-1 flex">
            <PromptList />
            <PromptEditor />
          </div>
        )}
        {activeView === "settings" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl">
            <WorkingDirectory />
            <ModelSettings />
            <GlobalPrompt />
            <Appearance />
          </div>
        )}
      </main>
    </div>
  );
}
