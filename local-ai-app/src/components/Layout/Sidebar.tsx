import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  MessageSquare,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";

const navItems = [
  { id: "chat" as const, label: "对话", icon: MessageSquare },
  { id: "prompts" as const, label: "提示词", icon: FileText },
  { id: "settings" as const, label: "设置", icon: Settings },
];

export function Sidebar() {
  const { activeView, setActiveView } = useSettingsStore();

  return (
    <aside className="w-16 bg-surface border-r border-theme flex flex-col items-center py-4 gap-2">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-4">
        <Sparkles size={20} className="text-white" />
      </div>

      {/* Navigation */}
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              activeView === item.id
                ? "bg-accent/20 text-accent"
                : "text-secondary hover:bg-surface-hover hover:text-main"
            )}
            title={item.label}
          >
            <Icon size={20} />
          </button>
        );
      })}

      {/* Bottom spacer */}
      <div className="flex-1" />
    </aside>
  );
}
