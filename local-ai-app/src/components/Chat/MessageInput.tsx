import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { usePromptStore } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { generateId, cn, PROVIDER_MAP } from "@/lib/utils";
import { Send, ChevronDown, Sparkles, FileText, Folder, BarChart3, Check } from "lucide-react";

export function MessageInput() {
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const promptPickerRef = useRef<HTMLDivElement>(null);

  const {
    getActiveConversation,
    addMessage,
    updateLastMessage,
    updateLastMessageReasoning,
    setStreaming,
    isStreaming,
    updateConversationModel,
    toggleConversationPrompt,
    updateConversationTokens,
  } = useChatStore();
  const { prompts, getPromptById } = usePromptStore();
  const { settings, models, updateSettings } = useSettingsStore();

  const conv = getActiveConversation();
  const effectiveDir = conv?.workingDirectory || settings.defaultDirectory || "";

  // Auto resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const isOutsideModel = modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node);
      const isOutsidePrompt = promptPickerRef.current && !promptPickerRef.current.contains(e.target as Node);
      if (isOutsideModel && isOutsidePrompt) {
        setShowModelPicker(false);
        setShowPromptPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const configuredModel = conv ? models.find((m) => m.modelName === conv.modelId) : null;
  const promptIds = conv?.promptIds || [];
  const activePrompts = promptIds.map((id) => getPromptById(id)).filter((p): p is NonNullable<typeof p> => !!p);

  const handleSend = async () => {
    if (!input.trim() || !conv || isStreaming) return;

    const userMsg = {
      id: generateId(),
      role: "user" as const,
      content: input.trim(),
      timestamp: Date.now(),
    };

    addMessage(conv.id, userMsg);
    setInput("");
    setStreaming(true);

    const assistantId = generateId();
    const assistantMsg = {
      id: assistantId,
      role: "assistant" as const,
      content: "",
      timestamp: Date.now(),
    };
    addMessage(conv.id, assistantMsg);

    try {
      // Build system prompt from global + all selected conversation prompts
      const systemPrompts: string[] = [];
      if (settings.globalPrompt.enabled && settings.globalPrompt.content) {
        systemPrompts.push(settings.globalPrompt.content);
      }
      // Use all selected prompts (promptIds)
      for (const pid of promptIds) {
        const p = getPromptById(pid);
        if (p) systemPrompts.push(p.content);
      }

      const apiMessages: { role: string; content: string }[] = [];
      if (systemPrompts.length > 0) {
        apiMessages.push({ role: "system", content: systemPrompts.join("\n\n") });
      }
      const history = getActiveConversation()?.messages.slice(-20) || [];
      history.forEach((m) => {
        if (m.id !== assistantId) {
          apiMessages.push({ role: m.role, content: m.content });
        }
      });

      const apiKey = configuredModel?.apiKey || "";
      const baseUrl = configuredModel?.baseUrl || PROVIDER_MAP.deepseek.baseUrl;
      const modelName = conv.modelId;

      if (!apiKey) {
        updateLastMessage(conv.id, "⚠️ 请先在设置页配置该模型的 API Key");
        return;
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: apiMessages,
          temperature: configuredModel?.temperature ?? 0.7,
          max_tokens: configuredModel?.maxTokens ?? 200000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let fullReasoning = "";
      let lastUsage: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) lastUsage = parsed.usage;
              const choice = parsed.choices?.[0]?.delta;
              if (choice?.reasoning_content) {
                fullReasoning += choice.reasoning_content;
                updateLastMessageReasoning(conv.id, fullReasoning);
              }
              if (choice?.content) {
                fullText += choice.content;
                updateLastMessage(conv.id, fullText);
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      // Track token usage
      if (lastUsage?.total_tokens) {
        updateConversationTokens(conv.id, lastUsage.total_tokens);
      } else {
        const estimatedTokens = Math.ceil(fullText.length / 4);
        updateConversationTokens(conv.id, estimatedTokens);
      }

      // Send system notification on completion
      if (typeof window !== "undefined" && window.electronAPI) {
        const now = new Date();
        const timeStr = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        window.electronAPI.sendNotification(
          "会话完成",
          `${conv.title} 已于 ${timeStr} 完成`
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "请求失败";
      updateLastMessage(conv.id, `\n\n---\n❌ 错误: ${errMsg}`);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const configuredModels = models.filter((m) => m.apiKey);
  const currentModel = configuredModels.find((m) => m.modelName === conv?.modelId);
  const formatTokens = (n?: number) => (n ? n.toLocaleString("zh-CN") : "");

  const handleSelectDir = async () => {
    if (typeof window !== "undefined" && window.electronAPI && conv) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        const { useChatStore } = await import("@/stores/chatStore");
        useChatStore.getState().updateConversationDirectory(conv.id, dir);
      }
    }
  };

  return (
    <div className="border-t border-theme bg-surface flex-shrink-0">
      {/* Model & Prompt bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="relative" ref={modelPickerRef}>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app border border-theme text-xs text-secondary hover:text-main transition-colors"
          >
            <Sparkles size={12} />
            {currentModel?.name || "选择模型"}
            <ChevronDown size={12} />
          </button>
          {showModelPicker && (
            <div className="absolute bottom-full mb-1 left-0 bg-surface border border-theme rounded-xl p-1 shadow-xl z-10 min-w-[200px]">
              {configuredModels.length === 0 ? (
                <div className="px-3 py-4 text-xs text-tertiary text-center">
                  未配置模型<br />请先在设置页添加并配置 API Key
                </div>
              ) : (
                configuredModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (conv) updateConversationModel(conv.id, model.modelName);
                      setShowModelPicker(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors",
                      conv?.modelId === model.modelName
                        ? "bg-accent/20 text-accent"
                        : "text-secondary hover:bg-surface-hover hover:text-main"
                    )}
                  >
                    <div className="font-medium">{model.name}</div>
                    <div className="text-tertiary mt-0.5 capitalize">{model.provider}</div>
                    <div className="text-tertiary mt-0.5 truncate">{model.modelName}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={promptPickerRef}>
          <button
            onClick={() => setShowPromptPicker(!showPromptPicker)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors",
              activePrompts.length > 0
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-app border-theme text-secondary hover:text-main"
            )}
          >
            <FileText size={12} />
            {activePrompts.length > 0
              ? `${activePrompts.length} 个提示词`
              : "无提示词"}
            <ChevronDown size={12} />
          </button>
          {showPromptPicker && (
            <div className="absolute bottom-full mb-1 left-0 bg-surface border border-theme rounded-xl p-1 shadow-xl z-10 min-w-[220px] max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-tertiary border-b border-theme">
                点击选择/取消提示词（可多选）
              </div>
              {prompts.map((p) => {
                const selected = promptIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (conv) toggleConversationPrompt(conv.id, p.id);
                      // Don't close the picker - allow multi-select
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2",
                      selected
                        ? "bg-accent/15 text-accent"
                        : "text-secondary hover:bg-surface-hover hover:text-main"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                        selected
                          ? "bg-accent border-accent"
                          : "border-theme"
                      )}
                    >
                      {selected && <Check size={10} className="text-white" />}
                    </span>
                    <div className="text-left">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-tertiary truncate max-w-[160px]">{p.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1" />
        {configuredModels.length === 0 && (
          <span className="text-[10px] text-amber-500">⚠️ 未配置模型</span>
        )}
        {/* Active prompts tags */}
        {activePrompts.length > 0 && (
          <div className="hidden md:flex items-center gap-1">
            {activePrompts.slice(0, 2).map((p) => (
              <span key={p.id} className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">
                {p.name}
              </span>
            ))}
            {activePrompts.length > 2 && (
              <span className="text-[10px] text-tertiary">+{activePrompts.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pb-2">
        <div className="flex items-end gap-2 bg-app border border-theme rounded-xl p-2 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "AI 正在回复..." : "输入消息，Shift+Enter 换行，Enter 发送"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-main placeholder-text-tertiary max-h-[200px] px-2"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0",
              input.trim() && !isStreaming
                ? "bg-accent hover:bg-accent-hover text-white"
                : "bg-surface-hover text-tertiary"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Bottom bar: Token + Directory + Global prompt indicator */}
      <div className="flex items-center gap-3 px-4 pb-2 text-[10px] text-tertiary">
        {/* Token count */}
        {conv?.totalTokens ? (
          <div className="flex items-center gap-1" title="当前会话 Token 消耗">
            <BarChart3 size={10} />
            <span>Token: {formatTokens(conv.totalTokens)}</span>
          </div>
        ) : null}

        {/* Default tokens label when 0 */}
        {conv && !conv.totalTokens && (
          <div className="flex items-center gap-1">
            <BarChart3 size={10} />
            <span>Token: 0</span>
          </div>
        )}

        {/* Directory */}
        <button
          onClick={handleSelectDir}
          className="flex items-center gap-1 hover:text-main transition-colors"
          title={effectiveDir || "点击选择工作目录"}
        >
          <Folder size={10} />
          <span className="truncate max-w-[150px]">
            {effectiveDir || "选择工作目录"}
          </span>
        </button>

        <div className="flex-1" />

        {/* Global prompt indicator */}
        {settings.globalPrompt.enabled && settings.globalPrompt.content && (
          <span title="全局提示词已启用">🌐 全局</span>
        )}

        {/* Active model display */}
        <span>{currentModel?.name || conv?.modelId || ""}</span>
      </div>
    </div>
  );
}
