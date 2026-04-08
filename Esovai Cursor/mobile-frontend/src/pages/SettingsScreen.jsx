import { useState, useEffect } from "react";
import { Moon, Sun, Bell, BellOff, Save, Terminal, Globe, FolderOpen, GitBranch, ShieldAlert, Search } from "lucide-react";
import { loadSettings, saveSettings } from "../lib/chatStore";
import { Switch } from "@/components/ui/switch";

export default function SettingsScreen() {
  const [settings, setSettings] = useState(loadSettings());
  const [saved, setSaved] = useState(false);
  const [perms, setPerms] = useState({ shell: false, web: false, fileSystem: false, git: false });
  const [permsLoading, setPermsLoading] = useState(false);
  const [searchProviders, setSearchProviders] = useState({ active: "auto", available: [] });
  const [searchSaved, setSearchSaved] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);

  useEffect(() => {
    fetch("/api/agent/permissions", {
      headers: { Authorization: `Bearer ${localStorage.getItem("kimi_token") || ""}` }
    })
      .then(r => r.json())
      .then(d => setPerms(d))
      .catch(() => {});

    fetch("/api/agent/search-providers", {
      headers: { Authorization: `Bearer ${localStorage.getItem("kimi_token") || ""}` }
    }).then(r => r.json()).then(d => setSearchProviders(d)).catch(() => {});
  }, []);

  const setSearchProvider = async (id) => {
    setSearchProviders(p => ({ ...p, active: id }));
    try {
      await fetch("/api/agent/search-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("kimi_token") || ""}` },
        body: JSON.stringify({ provider: id })
      });
      setSearchSaved(true);
      setTimeout(() => setSearchSaved(false), 1500);
    } catch {}
  };

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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

  const togglePerm = async (key) => {
    const next = { ...perms, [key]: !perms[key] };
    setPerms(next);
    setPermsLoading(true);
    try {
      await fetch("/api/agent/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("kimi_token") || ""}`
        },
        body: JSON.stringify({ [key]: next[key] })
      });
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 1500);
    } catch {
      setPerms(perms);
    } finally {
      setPermsLoading(false);
    }
  };

  const permItems = [
    {
      key: "web",
      icon: <Globe className="w-5 h-5 text-blue-500" />,
      label: "Web Search",
      desc: "Internet-Suche & URL-Fetch",
      danger: false,
    },
    {
      key: "fileSystem",
      icon: <FolderOpen className="w-5 h-5 text-amber-500" />,
      label: "Dateisystem",
      desc: "Lesen & Schreiben in /data",
      danger: false,
    },
    {
      key: "git",
      icon: <GitBranch className="w-5 h-5 text-purple-500" />,
      label: "Git",
      desc: "Git-Befehle in /data",
      danger: false,
    },
    {
      key: "shell",
      icon: <Terminal className="w-5 h-5 text-destructive" />,
      label: "Shell",
      desc: "Bash-Befehle ausführen",
      danger: true,
    },
  ];

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto">
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

        {/* Search Provider */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Web Search Provider</span>
            </div>
            {searchSaved && <span className="text-xs text-green-500 font-medium">Gespeichert ✓</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {searchProviders.available.map(p => (
              <button
                key={p.id}
                onClick={() => setSearchProvider(p.id)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                  searchProviders.active === p.id
                    ? "bg-primary text-primary-foreground"
                    : p.configured
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-secondary/50 text-muted-foreground opacity-50"
                }`}
              >
                {p.label}
                {!p.configured && " ⚠️"}
              </button>
            ))}
          </div>
          {searchProviders.available.find(p => p.id === searchProviders.active && !p.configured) && (
            <p className="text-xs text-amber-500 mt-2">⚠️ Kein API Key für diesen Provider in .env</p>
          )}
        </div>

        {/* Agent Permissions */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Agent Permissions</span>
            </div>
            {permsSaved && (
              <span className="text-xs text-green-500 font-medium">Gespeichert ✓</span>
            )}
          </div>

          <div className="space-y-1">
            {permItems.map(({ key, icon, label, desc, danger }) => (
              <div
                key={key}
                className={`flex items-center justify-between px-3 py-3 rounded-xl ${
                  danger && perms[key] ? "bg-destructive/10 border border-destructive/30" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={!!perms[key]}
                  onCheckedChange={() => togglePerm(key)}
                  disabled={permsLoading}
                />
              </div>
            ))}
          </div>

          {perms.shell && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-destructive/10 rounded-xl border border-destructive/20">
              <Terminal className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">
                Shell ist aktiv — der Agent kann beliebige Bash-Befehle auf dem Server ausführen. Nur bewusst aktivieren.
              </p>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <label className="text-sm font-semibold mb-2 block">System Prompt</label>
          <textarea
            value={settings.systemPrompt || ""}
            onChange={(e) => update("systemPrompt", e.target.value)}
            rows={4}
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* App Toggles */}
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              {settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span className="text-sm font-medium">Dark Mode</span>
            </div>
            <Switch
              checked={!!settings.darkMode}
              onCheckedChange={(val) => update("darkMode", val)}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              {settings.pushNotifications ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              <span className="text-sm font-medium">Push Notifications</span>
            </div>
            <Switch
              checked={!!settings.pushNotifications}
              onCheckedChange={(val) => update("pushNotifications", val)}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 min-h-[48px] transition-all active:scale-[0.98] ${
            saved ? "bg-success/20 text-success" : "bg-primary text-primary-foreground"
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
