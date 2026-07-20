import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULT_MODELS, PROVIDER_MAP } from "@/lib/utils";
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";

export function ModelSettings() {
  const { models, addModel, updateModel, removeModel } = useSettingsStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);

  const handleAddModel = (modelId: string) => {
    const model = DEFAULT_MODELS.find((m) => m.id === modelId);
    if (!model) return;
    const provider = PROVIDER_MAP[model.provider];
    addModel({
      name: model.name,
      provider: model.provider as any,
      apiKey: "",
      baseUrl: provider?.baseUrl || "",
      modelName: model.id,
      maxTokens: 200000,
      temperature: 0.7,
    });
    // Auto-expand the new model
    const newModel = useSettingsStore.getState().models.slice(-1)[0];
    if (newModel) setExpanded(newModel.id);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-main">模型配置</h2>
          <p className="text-sm text-secondary mt-1">
            管理你的 API 密钥和模型参数
          </p>
        </div>
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-xs text-white transition-colors">
            <Plus size={14} />
            添加模型
          </button>
          <div className="absolute right-0 top-full mt-1 bg-surface border border-theme rounded-xl p-1 shadow-xl z-10 min-w-[180px] hidden group-hover:block">
            {DEFAULT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => handleAddModel(m.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-secondary hover:bg-surface-hover hover:text-main transition-colors"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {models.length === 0 ? (
          <div className="text-center py-8 text-tertiary text-sm">
            还没有配置模型，点击"添加模型"开始
          </div>
        ) : (
          models.map((model) => (
            <div
              key={model.id}
              className="bg-surface border border-theme rounded-xl overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() =>
                  setExpanded(expanded === model.id ? null : model.id)
                }
              >
                <div className="flex items-center gap-3">
                  {expanded === model.id ? (
                    <ChevronDown size={16} className="text-tertiary" />
                  ) : (
                    <ChevronRight size={16} className="text-tertiary" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-main">
                      {model.name}
                    </div>
                    <div className="text-xs text-tertiary">{model.provider}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeModel(model.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#ff3333]/20 text-secondary hover:text-[#ff4444] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {expanded === model.id && (
                <div className="px-4 py-3 border-t border-theme space-y-3">
                  <div>
                    <label className="text-xs text-secondary block mb-1">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey === model.id ? "text" : "password"}
                        value={model.apiKey}
                        onChange={(e) =>
                          updateModel(model.id, { apiKey: e.target.value })
                        }
                        className="w-full bg-app border border-theme rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-accent/50 transition-colors pr-8"
                        placeholder="sk-..."
                      />
                      <button
                        onClick={() =>
                          setShowKey(showKey === model.id ? null : model.id)
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-main"
                      >
                        {showKey === model.id ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-secondary block mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={model.baseUrl}
                      onChange={(e) =>
                        updateModel(model.id, { baseUrl: e.target.value })
                      }
                      className="w-full bg-app border border-theme rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-secondary block mb-1">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={model.maxTokens}
                        onChange={(e) =>
                          updateModel(model.id, {
                            maxTokens: parseInt(e.target.value) || 200000,
                          })
                        }
                        className="w-full bg-app border border-theme rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-secondary block mb-1">
                        Temperature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={model.temperature}
                        onChange={(e) =>
                          updateModel(model.id, {
                            temperature: parseFloat(e.target.value) || 0.7,
                          })
                        }
                        className="w-full bg-app border border-theme rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
