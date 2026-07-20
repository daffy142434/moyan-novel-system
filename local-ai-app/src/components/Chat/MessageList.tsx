import { useChatStore } from "@/stores/chatStore";
import { usePromptStore } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { Bot, User, Sparkles, ChevronDown, ChevronRight, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useEffect, useRef, useState } from "react";

function ReasoningBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 bg-surface/60 border border-theme rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-secondary hover:text-main transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} className="text-accent" />
        <span>思考过程</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs text-secondary leading-relaxed whitespace-pre-wrap border-t border-theme pt-2 mt-0">
          {content}
        </div>
      )}
    </div>
  );
}

export function MessageList() {
  const { getActiveConversation, isStreaming } = useChatStore();
  const { getPromptById } = usePromptStore();
  const { settings } = useSettingsStore();
  const listRef = useRef<HTMLDivElement>(null);
  const conv = getActiveConversation();

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [conv?.messages]);

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-tertiary min-h-0">
        <div className="text-center">
          <Sparkles size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">选择或创建一个对话开始</p>
        </div>
      </div>
    );
  }

  // Build effective system prompt
  const effectivePrompts: string[] = [];
  if (settings.globalPrompt.enabled && settings.globalPrompt.content) {
    effectivePrompts.push(`[全局提示] ${settings.globalPrompt.content}`);
  }
  if (conv.promptId) {
    const prompt = getPromptById(conv.promptId);
    if (prompt) {
      effectivePrompts.push(`[对话提示] ${prompt.name}`);
    }
  }

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4"
    >
      {/* Effective prompt indicator */}
      {effectivePrompts.length > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-2 text-xs text-secondary">
          <span className="text-accent font-medium mr-2">提示词生效:</span>
          {effectivePrompts.join(" | ")}
        </div>
      )}

      {conv.messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-tertiary">
          <div className="text-center">
            <Bot size={40} className="mx-auto mb-3 opacity-30" />
            <p>开始一段新的对话</p>
            <p className="text-sm mt-1">输入消息，AI 将为你回复</p>
          </div>
        </div>
      ) : (
        conv.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-accent" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-md"
                  : "bg-surface border border-theme rounded-bl-md"
              )}
            >
              {/* Thinking process */}
              {msg.reasoningContent && (
                <ReasoningBlock content={msg.reasoningContent} />
              )}
              {/* Main content */}
              {msg.role === "assistant" ? (
                <div className="markdown-body text-sm leading-relaxed">
                  <ReactMarkdown>{msg.content || (isStreaming ? "..." : "")}</ReactMarkdown>
                  {isStreaming && msg.content === "" && (
                    <span className="inline-block w-2 h-4 bg-accent animate-pulse" />
                  )}
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                <User size={16} className="text-white" />
              </div>
            )}
          </div>
        ))
      )}

      {/* Streaming indicator */}
      {isStreaming && !conv.messages[conv.messages.length - 1]?.content && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Bot size={16} className="text-accent" />
          </div>
          <div className="bg-surface border border-theme rounded-2xl rounded-bl-md px-4 py-3">
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay: "0ms"}} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay: "150ms"}} />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay: "300ms"}} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
