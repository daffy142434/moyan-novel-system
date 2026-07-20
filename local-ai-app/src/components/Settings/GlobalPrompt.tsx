import { useSettingsStore } from "@/stores/settingsStore";

export function GlobalPrompt() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-main">全局提示词</h2>
          <p className="text-sm text-secondary mt-1">
            在所有对话中生效的 System Prompt，与对话级提示词叠加
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.globalPrompt.enabled}
            onChange={(e) =>
              updateSettings({
                globalPrompt: {
                  ...settings.globalPrompt,
                  enabled: e.target.checked,
                },
              })
            }
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-[#2a2b36] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
        </label>
      </div>

      <div className="bg-surface border border-theme rounded-xl p-4">
        <p className="text-xs text-tertiary mb-3">
          这个提示词会被注入到每个对话的上下文中，与对话选择的提示词合并发送给模型。
        </p>
        <textarea
          value={settings.globalPrompt.content}
          onChange={(e) =>
            updateSettings({
              globalPrompt: {
                ...settings.globalPrompt,
                content: e.target.value,
              },
            })
          }
          disabled={!settings.globalPrompt.enabled}
          className="w-full bg-app border border-theme rounded-lg p-3 text-xs font-mono text-main resize-none outline-none focus:border-accent/50 transition-colors disabled:opacity-50 h-32"
          placeholder="输入全局提示词内容..."
        />
      </div>
    </section>
  );
}
