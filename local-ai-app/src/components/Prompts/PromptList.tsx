import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export function PromptList() {
  const { prompts, selectedPromptId, selectPrompt, createPrompt } =
    usePromptStore();
  const [search, setSearch] = useState("");

  const filtered = prompts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = () => {
    createPrompt(
      "新提示词",
      "",
      "你是一个有用的 AI 助手。\n\n请根据以下要求：\n{{task}}",
      ["自定义"]
    );
  };

  return (
    <div className="w-72 bg-surface border-r border-theme flex flex-col">
      <div className="p-3 border-b border-theme">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-secondary">提示词库</span>
          <button
            onClick={handleCreate}
            className="w-7 h-7 rounded-lg bg-accent hover:bg-accent-hover flex items-center justify-center transition-colors"
            title="新建提示词"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索提示词..."
            className="w-full bg-app border border-theme rounded-lg pl-8 pr-3 py-1.5 text-xs text-main placeholder-text-tertiary outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => selectPrompt(p.id)}
            className={cn(
              "px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
              p.id === selectedPromptId
                ? "bg-accent/15"
                : "hover:bg-surface-hover"
            )}
          >
            <div className="text-sm text-main font-medium">
              {p.name}
            </div>
            <div className="text-xs text-secondary mt-0.5 line-clamp-2">
              {p.description}
            </div>
            {p.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-surface-hover text-tertiary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
