import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

export const PROVIDERS = [
  { id: "base44", label: "Base44 AI ✨", sublabel: "günstig & kostenlos", models: [{ id: "", label: "Base44 AI" }] },
  { id: "ollama", label: "Ollama", sublabel: "Lokal & Cloud", localModels: [
    { id: "llama3", label: "LLaMA 3" },
    { id: "mistral", label: "Mistral" },
    { id: "qwen2.5", label: "Qwen2.5" },
    { id: "phi4", label: "Phi-4" },
    { id: "gemma3", label: "Gemma 3" },
  ], cloudModels: [
    { id: "kimi-k2.6:cloud", label: "Kimi K2.6" },
    { id: "llama3.3:cloud", label: "LLaMA 3.3" },
    { id: "gemma3:cloud", label: "Gemma 3" },
    { id: "qwen2.5:cloud", label: "Qwen2.5" },
    { id: "mistral:cloud", label: "Mistral" },
    { id: "phi4:cloud", label: "Phi-4" },
  ], models: [
    { id: "llama3", label: "LLaMA 3" },
    { id: "mistral", label: "Mistral" },
    { id: "qwen2.5", label: "Qwen2.5" },
    { id: "phi4", label: "Phi-4" },
    { id: "gemma3", label: "Gemma 3" },
    { id: "kimi-k2.6:cloud", label: "Kimi K2.6 ☁️" },
    { id: "llama3.3:cloud", label: "LLaMA 3.3 ☁️" },
    { id: "gemma3:cloud", label: "Gemma 3 ☁️" },
    { id: "qwen2.5:cloud", label: "Qwen2.5 ☁️" },
    { id: "mistral:cloud", label: "Mistral ☁️" },
    { id: "phi4:cloud", label: "Phi-4 ☁️" },
  ]},
  { id: "opencode-go", label: "OpenCode Go ⚡", sublabel: "Abo", models: [
    { id: "kimi-k2.6", label: "Kimi K2.6" },
    { id: "glm-5", label: "GLM-5" },
    { id: "minimax-m2.5", label: "MiniMax M2.5" },
    { id: "minimax-m2.7", label: "MiniMax M2.7" },
  ]},
  { id: "openai", label: "OpenAI", sublabel: "API-Key", models: [
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  ]},
  { id: "anthropic", label: "Anthropic", sublabel: "API-Key", models: [
    { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4", label: "Claude Opus 4" },
  ]},
  { id: "google", label: "Google", sublabel: "API-Key", models: [
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
    { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  ]},
  { id: "xai", label: "xAI", sublabel: "API-Key", models: [
    { id: "grok-3", label: "Grok 3" },
  ]},
];

export function getActiveProvider() {
  const id = localStorage.getItem("kimi_provider") || "base44";
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
}

export function getActiveModel(provider) {
  const p = provider || getActiveProvider();
  if (p.models.length === 1) return p.models[0];
  const modelId = localStorage.getItem("kimi_model") || p.models[0].id;
  return p.models.find(m => m.id === modelId) || p.models[0];
}

export default function ProviderSheet({ open, onClose }) {
  const [selectedProvider, setSelectedProvider] = useState(getActiveProvider());
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    if (open) {
      const p = getActiveProvider();
      setSelectedProvider(p);
      setSelectedModel(getActiveModel(p));
    }
  }, [open]);

  const handleSelectProvider = (p) => {
    setSelectedProvider(p);
    setSelectedModel(p.models[0]);
  };

  const handleConfirm = () => {
    localStorage.setItem("kimi_provider", selectedProvider.id);
    localStorage.setItem("kimi_model", selectedModel?.id || "");
    onClose();
  };

  if (!open) return null;

  const showModels = selectedProvider.models.length > 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl border-t border-border max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-base">Provider wählen</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Providers */}
          <div className="p-3 space-y-1.5">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectProvider(p)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-colors min-h-[56px] ${
                  selectedProvider.id === p.id
                    ? "bg-primary/15 border border-primary/40"
                    : "bg-secondary"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.sublabel}</div>
                </div>
                {selectedProvider.id === p.id && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Models */}
          {showModels && (
            <div className="px-3 pb-3">
              {selectedProvider.localModels ? (
                <>
                  {/* Lokal */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">🖥️ Lokal</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedProvider.localModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                          selectedModel?.id === m.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {/* Cloud */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">☁️ Cloud</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.cloudModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                          selectedModel?.id === m.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Modell</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.models.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                          selectedModel?.id === m.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="p-4 border-t border-border safe-bottom">
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm min-h-[48px] active:scale-[0.98] transition-transform"
          >
            Auswahl bestätigen
          </button>
        </div>
      </div>
    </>
  );
}