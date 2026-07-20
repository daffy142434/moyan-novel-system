import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { cn, formatDate, truncate } from "@/lib/utils";
import { Plus, Trash2, Check, X, PanelLeftClose, PanelLeft, MessageSquare } from "lucide-react";

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          className="flex-1 bg-app border border-accent/50 rounded px-1.5 py-0.5 text-xs text-main outline-none min-w-0"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="p-0.5 rounded hover:bg-accent/20 text-accent"
        >
          <Check size={12} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setEditing(false)}
          className="p-0.5 rounded hover:bg-[#ff3333]/20 text-[#ff4444]"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="text-sm truncate cursor-text hover:text-main transition-colors"
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="双击重命名"
    >
      {truncate(value, 20)}
    </div>
  );
}

export function ConversationList() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
  } = useChatStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleNew = () => {
    const id = createConversation("deepseek-v4-flash");
    setActiveConversation(id);
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-surface border-r border-theme flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="w-7 h-7 rounded-lg hover:bg-surface-hover flex items-center justify-center text-secondary hover:text-main transition-colors"
          title="展开对话列表"
        >
          <PanelLeft size={16} />
        </button>
        <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto px-1">
          {conversations.slice(-6).map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-colors flex-shrink-0",
                conv.id === activeConversationId
                  ? "bg-accent text-white"
                  : "text-secondary hover:bg-surface-hover hover:text-main"
              )}
              title={conv.title}
            >
              {conv.title.charAt(0)}
            </button>
          ))}
        </div>
        <button
          onClick={handleNew}
          className="w-7 h-7 rounded-lg hover:bg-surface-hover flex items-center justify-center text-secondary hover:text-main transition-colors"
          title="新建对话"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-surface border-r border-theme flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-theme flex items-center justify-between">
        <span className="text-sm font-medium text-secondary">对话列表</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNew}
            className="w-7 h-7 rounded-lg bg-accent hover:bg-accent-hover flex items-center justify-center transition-colors"
            title="新建对话"
          >
            <Plus size={16} className="text-white" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg hover:bg-surface-hover flex items-center justify-center text-secondary hover:text-main transition-colors"
            title="折叠侧栏"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-tertiary text-xs">
            暂无对话，点击 + 新建
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                conv.id === activeConversationId
                  ? "bg-accent/15 text-main"
                  : "hover:bg-surface-hover text-secondary"
              )}
              onClick={() => setActiveConversation(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <EditableTitle
                  value={conv.title}
                  onSave={(v) => updateConversationTitle(conv.id, v)}
                />
                <div className="text-xs text-tertiary mt-0.5">
                  {formatDate(conv.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#ff3333]/20 hover:text-[#ff4444] transition-all flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
