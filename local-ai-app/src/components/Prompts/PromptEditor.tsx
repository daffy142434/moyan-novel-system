import { useState, useEffect } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";
import { Save, RotateCcw, Trash2 } from "lucide-react";

export function PromptEditor() {
  const { selectedPromptId, prompts, updatePrompt, deletePrompt, selectPrompt } =
    usePromptStore();
  const selected = prompts.find((p) => p.id === selectedPromptId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDescription(selected.description);
      setContent(selected.content);
    } else {
      setName("");
      setDescription("");
      setContent("");
    }
  }, [selected]);

  const handleSave = () => {
    if (!selected) return;
    updatePrompt(selected.id, { name, description, content });
  };

  const handleDelete = () => {
    if (!selected) return;
    if (confirm(`确定删除提示词「${selected.name}」？`)) {
      deletePrompt(selected.id);
    }
  };

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center text-tertiary">
        <p className="text-sm">选择一个提示词进行编辑</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="h-12 px-4 border-b border-theme flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-medium text-main"
          />
          {selected.variables.length > 0 && (
            <span className="text-xs text-tertiary">
              {selected.variables.join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-xs text-white transition-colors"
          >
            <Save size={14} />
            保存
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent hover:bg-[#ff3333]/20 text-secondary hover:text-[#ff4444] text-xs transition-colors"
          >
            <Trash2 size={14} />
            删除
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-app border border-theme rounded-xl p-4 text-xs font-mono text-main resize-none outline-none focus:border-accent/50 transition-colors"
            placeholder="在此编写提示词内容..."
          />
        </div>

        {/* Variables panel */}
        <div className="w-48 p-4 border-l border-theme">
          <div className="text-xs font-medium text-secondary mb-3">变量</div>
          {selected.variables.length > 0 ? (
            <div className="space-y-2">
              {selected.variables.map((v) => (
                <div
                  key={v}
                  className="px-2 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent"
                >
                  {`{{${v}}}`}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-tertiary">
              使用{"{{变量名}}"}语法创建变量
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
