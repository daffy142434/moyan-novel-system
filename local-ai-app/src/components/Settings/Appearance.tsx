import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { Moon, Sun, Monitor, Check } from "lucide-react";

const themes = [
  { id: "dark" as const, label: "深色", icon: Moon },
  { id: "light" as const, label: "浅色", icon: Sun },
  { id: "system" as const, label: "跟随系统", icon: Monitor },
];

const PRESET_COLORS = [
  { name: "默认蓝", color: "#1a73ff" },
  { name: "青绿", color: "#0ea5e9" },
  { name: "翡翠", color: "#10b981" },
  { name: "紫色", color: "#8b5cf6" },
  { name: "粉色", color: "#ec4899" },
  { name: "橙色", color: "#f97316" },
  { name: "玫瑰红", color: "#ef4444" },
  { name: "青色", color: "#06b6d4" },
];

export function Appearance() {
  const { settings, updateSettings } = useSettingsStore();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-main">外观</h2>
        <p className="text-sm text-secondary mt-1">
          自定义主题色和界面显示
        </p>
      </div>

      <div className="bg-surface border border-theme rounded-xl p-4 space-y-6">
        {/* Theme mode */}
        <div>
          <label className="text-xs text-secondary block mb-2">主题模式</label>
          <div className="flex gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs transition-colors",
                    settings.theme === t.id
                      ? "border-current text-current"
                      : "bg-app border-theme text-secondary hover:text-main"
                  )}
                  style={
                    settings.theme === t.id
                      ? {
                          backgroundColor: `${settings.accentColor}20`,
                          borderColor: `${settings.accentColor}50`,
                          color: settings.accentColor,
                        }
                      : undefined
                  }
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <label className="text-xs text-secondary block mb-2">
            主题色
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(({ name, color }) => (
              <button
                key={color}
                onClick={() => updateSettings({ accentColor: color })}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-110",
                  settings.accentColor === color && "ring-2 ring-offset-2 ring-offset-surface"
                )}
                style={{ backgroundColor: color }}
                title={name}
              >
                {settings.accentColor === color && (
                  <Check size={16} className="text-white" />
                )}
              </button>
            ))}

            {/* Custom color input */}
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="w-9 h-9 rounded-xl border-2 border-dashed border-theme flex items-center justify-center text-secondary hover:text-main text-xs"
                title="自定义颜色"
              >
                +
              </button>
              {showPicker && (
                <div className="absolute top-full left-0 mt-2 bg-surface border border-theme rounded-xl p-3 shadow-xl z-10">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) =>
                      updateSettings({ accentColor: e.target.value })
                    }
                    className="w-32 h-8 rounded cursor-pointer"
                  />
                  <button
                    onClick={() => setShowPicker(false)}
                    className="mt-2 w-full text-xs text-center text-secondary hover:text-main"
                  >
                    确定
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Font size */}
        <div>
          <label className="text-xs text-secondary block mb-2">
            字体大小: {settings.fontSize}px
          </label>
          <input
            type="range"
            min="12"
            max="20"
            value={settings.fontSize}
            onChange={(e) =>
              updateSettings({ fontSize: parseInt(e.target.value) })
            }
            className="w-full h-1.5 bg-surface-hover rounded-full appearance-none cursor-pointer"
            style={{ accentColor: settings.accentColor }}
          />
        </div>
      </div>
    </section>
  );
}
