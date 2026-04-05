import { useState, useEffect } from "react";
import { Moon, Sun, Bell, BellOff, Save } from "lucide-react";
import { loadSettings, saveSettings } from "../lib/chatStore";
import { Switch } from "@/components/ui/switch";

const providers = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "local", label: "Lokal" }
];

const models = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  anthropic: ["claude-3.5-sonnet", "claude-3-opus"],
  local: ["llama-3", "mistral-7b"]
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState(loadSettings());
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === "provider") {
        next.model = models[value]?.[0] || "";
      }
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToken = (val) => {
    localStorage.setItem("kimi_token", val);
  };

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 safe-top">
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">App konfigurieren</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* API Token */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <label className="text-sm font-semibold mb-2 block">API Token</label>
          <input
            type="password"
            defaultValue={localStorage.getItem("kimi_token") || ""}
            onChange={(e) => handleToken(e.target.value)}
            placeholder="Bearer Token eingeben..."
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Provider & Model */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div>
            <label className="text-sm font-semibold mb-2 block">Provider</label>
            <div className="flex gap-2">
              {providers.map(p => (
                <button
                  key={p.value}
                  onClick={() => update("provider", p.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    settings.provider === p.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Model</label>
            <div className="flex flex-wrap gap-2">
              {(models[settings.provider] || []).map(m => (
                <button
                  key={m}
                  onClick={() => update("model", m)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    settings.model === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <label className="text-sm font-semibold mb-2 block">System Prompt</label>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
            rows={4}
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Toggles */}
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              {settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span className="text-sm font-medium">Dark Mode</span>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(val) => update("darkMode", val)}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              {settings.pushNotifications ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              <span className="text-sm font-medium">Push Notifications</span>
            </div>
            <Switch
              checked={settings.pushNotifications}
              onCheckedChange={(val) => update("pushNotifications", val)}
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 min-h-[48px] transition-all active:scale-[0.98] ${
            saved
              ? "bg-success/20 text-success"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? "Gespeichert ✓" : "Einstellungen speichern"}
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}