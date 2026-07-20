import { useSettingsStore } from "@/stores/settingsStore";
import { useChatStore } from "@/stores/chatStore";
import { FolderOpen, Folder } from "lucide-react";

export function WorkingDirectory() {
  const { settings, updateSettings } = useSettingsStore();
  const { conversations, updateConversationDirectory } = useChatStore();

  const handleSelectDefault = async () => {
    if (typeof window !== "undefined" && window.electronAPI) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) updateSettings({ defaultDirectory: dir });
    } else {
      alert("请在桌面客户端中设置目录");
    }
  };

  const handleSelectConv = async (convId: string) => {
    if (typeof window !== "undefined" && window.electronAPI) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) updateConversationDirectory(convId, dir);
    }
  };

  // Count total tokens across all conversations
  const totalTokens = conversations.reduce((sum, c) => sum + (c.totalTokens || 0), 0);

  const formatNumber = (n: number): string => {
    return n.toLocaleString("zh-CN");
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-main">工作目录</h2>
        <p className="text-sm text-secondary mt-1">
          所有文件操作限定在该目录范围内
        </p>
      </div>

      <div className="bg-surface border border-theme rounded-xl p-4 space-y-4">
        {/* Default directory */}
        <div>
          <label className="text-xs text-secondary block mb-2">默认工作目录</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={settings.defaultDirectory || ""}
              readOnly
              placeholder="未设置，点击右侧按钮选择目录"
              className="flex-1 bg-app border border-theme rounded-lg px-3 py-2 text-xs text-main outline-none"
            />
            <button
              onClick={handleSelectDefault}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-xs text-white transition-colors"
            >
              <FolderOpen size={14} />
              选择目录
            </button>
          </div>
          <p className="text-xs text-tertiary mt-1.5">
            每个对话可单独设置工作目录，未设置的对话使用此默认值
          </p>
        </div>

        {/* Conversation-specific directories */}
        {conversations.filter((c) => c.workingDirectory).length > 0 && (
          <div className="border-t border-theme pt-4">
            <label className="text-xs text-secondary block mb-2">会话独立目录</label>
            <div className="space-y-2">
              {conversations
                .filter((c) => c.workingDirectory)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app border border-theme"
                  >
                    <Folder size={14} className="text-accent" />
                    <span className="flex-1 text-xs text-main truncate">{c.title}</span>
                    <span className="text-xs text-tertiary truncate max-w-[200px]">{c.workingDirectory}</span>
                    <button
                      onClick={() => handleSelectConv(c.id)}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      修改
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Token Summary */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-main mb-4">Token 消耗统计</h2>
        <div className="bg-surface border border-theme rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-theme">
            <div className="text-sm font-medium text-main">
              总计消耗: {formatNumber(totalTokens)} Tokens
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-theme">
            {conversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-tertiary text-xs">暂无对话记录</div>
            ) : (
              [...conversations]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => (
                  <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-main truncate max-w-[200px]">{c.title}</span>
                    <span className="text-xs text-secondary">
                      {formatNumber(c.totalTokens || 0)} Tokens
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
