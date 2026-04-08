import { useState, useEffect, useCallback } from "react";
import { Bot, Power, RefreshCw, Briefcase, ChevronDown, ChevronUp, Play, Download, Copy, Check as CheckIcon, Mail, MailOpen, Inbox, Globe, Terminal, FolderOpen, GitBranch, Zap, Search, BookOpen, CheckCircle2, Trash2 } from "lucide-react";
import { getAgentStatus, sendAgentTask } from "../lib/kimiApi";
import { Switch } from "@/components/ui/switch";

function JobResultCard({ id, label, content, updatedAt, status }) {
  const [open, setOpen] = useState(false);
  const lines = (content || "").split("\n").filter(l => l.trim() && l !== "Keine passenden Stellen gefunden." && l !== "Keine Suchergebnisse gefunden.");
  const noResults = !lines.length;

  return (
    <div className="mx-4 mb-3 bg-card rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 min-h-[56px]"
      >
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-primary shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">
              {status === "running" ? "Sucht..." : updatedAt ? new Date(updatedAt).toLocaleString("de-DE") : "Noch nicht gelaufen"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!noResults && (
            <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {lines.length}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {noResults ? (
            <p className="text-sm text-muted-foreground text-center py-2">Keine passenden Stellen gefunden</p>
          ) : (
            lines.map((line, i) => {
              const parts = line.split("|").map(p => p.trim());
              if (parts.length >= 4) {
                const [title, company, location, remote, link, date] = parts;
                return (
                  <div key={i} className="bg-secondary/50 rounded-xl p-3 space-y-1">
                    <p className="text-sm font-medium leading-tight">{title}</p>
                    <p className="text-xs text-muted-foreground">{company} · {location}</p>
                    {remote && <span className="text-xs bg-blue-500/15 text-blue-500 px-2 py-0.5 rounded-full">{remote}</span>}
                    <div className="flex items-center justify-between pt-1">
                      {date && <p className="text-xs text-muted-foreground">{date}</p>}
                      {link && link.startsWith("http") && (
                        <a href={link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary underline">Bewerben →</a>
                      )}
                    </div>
                  </div>
                );
              }
              return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
            })
          )}
        </div>
      )}
    </div>
  );
}

function PostfachEntry({ entry, onMarkRead, onDelete }) {
  const [open, setOpen] = useState(false);
  const typeIcon = entry.type === "jobs" ? "💼" : entry.type === "alert" ? "🔔" : "ℹ️";

  const handleOpen = () => {
    setOpen(o => !o);
    if (!entry.read) onMarkRead(entry.id);
  };

  // Parse job blocks from "Titel:/URL:/Beschreibung:" format
  const parseBlocks = (text) => {
    const blocks = (text || "").split("---").map(b => b.trim()).filter(Boolean);
    return blocks.map(block => ({
      titel: block.match(/Titel:\s*(.+)/)?.[1]?.trim() || "",
      url:   block.match(/URL:\s*(\S+)/)?.[1]?.trim() || "",
      desc:  block.match(/Beschreibung:\s*(.+)/s)?.[1]?.trim().slice(0, 180) || "",
    })).filter(b => b.titel || b.url);
  };

  const isJobContent = (text) => (text || "").includes("Titel:") && (text || "").includes("URL:");

  return (
    <div className={`mx-4 mb-2 rounded-2xl border overflow-hidden transition-colors ${entry.read ? "bg-card border-border" : "bg-primary/5 border-primary/30"}`}>
      <button onClick={handleOpen} className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[60px] text-left">
        <div className="flex-shrink-0 text-xl">{typeIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!entry.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            <p className={`text-sm leading-snug truncate ${entry.read ? "font-medium" : "font-semibold"}`}>{entry.title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(entry.timestamp).toLocaleString("de-DE")}
          </p>
        </div>
        <div className="flex-shrink-0">
          {entry.read
            ? <MailOpen className="w-4 h-4 text-muted-foreground/50" />
            : <Mail className="w-4 h-4 text-primary" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {isJobContent(entry.content) ? (
            parseBlocks(entry.content).map((job, i) => (
              <div key={i} className="rounded-xl border border-border bg-background px-3 py-2.5">
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline leading-snug block">{job.titel}</a>
                {job.desc && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{job.desc}</p>}
                <p className="text-xs text-muted-foreground/50 mt-1 truncate">{job.url}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{entry.content}</p>
          )}
          <button onClick={() => onDelete(entry.id)}
            className="text-xs text-destructive/70 hover:text-destructive flex items-center gap-1 pt-1 active:opacity-70">
            <Trash2 className="w-3 h-3" /> Löschen
          </button>
        </div>
      )}
    </div>
  );
}

const SKILLS = [
  {
    key: "web",
    icon: Globe,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Web-Suche",
    desc: "Sucht im Internet nach aktuellen Informationen",
    examples: ["Aktuelle Nachrichten abrufen", "Preise vergleichen", "Fakten nachschlagen"],
    danger: false,
  },
  {
    key: "fileSystem",
    icon: FolderOpen,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Dateisystem",
    desc: "Liest und schreibt Dateien im /data Ordner auf dem Server",
    examples: ["Notizen speichern", "Daten lesen", "Dateien erstellen"],
    danger: false,
  },
  {
    key: "git",
    icon: GitBranch,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    label: "Git",
    desc: "Führt Git-Befehle aus — Commits, Logs, Diffs",
    examples: ["Letzten Commit anzeigen", "Änderungen committen", "Branch-Status"],
    danger: false,
  },
  {
    key: "shell",
    icon: Terminal,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Shell / Bash",
    desc: "Führt beliebige Bash-Befehle auf dem Server aus",
    examples: ["Systemauslastung prüfen", "Prozesse anzeigen", "Skripte ausführen"],
    danger: true,
  },
];

const BUILTIN_SKILLS = [
  {
    icon: Search,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Job-Crawler",
    desc: "Durchsucht automatisch Jobportale nach passenden Stellen (läuft stündlich)",
    examples: ["Stepstone, Indeed, LinkedIn scannen", "Stellen nach Profil filtern", "Ergebnisse ins Postfach schreiben"],
  },
  {
    icon: BookOpen,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    label: "Postfach",
    desc: "Sendet dir automatisch Benachrichtigungen und Zusammenfassungen",
    examples: ["Job-Ergebnisse weiterleiten", "Alerts senden", "Notizen speichern"],
  },
  {
    icon: Zap,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "Chat-Assistent",
    desc: "Beantwortet Fragen, schreibt Texte und hilft bei Aufgaben im ESO Bot Chat",
    examples: ["Bewerbungsschreiben erstellen", "Fragen beantworten", "Zusammenfassungen"],
  },
];

function SkillCard({ skill, enabled, onToggle, loading }) {
  const [open, setOpen] = useState(false);
  const Icon = skill.icon;

  return (
    <div className={`mx-4 mb-2 rounded-2xl border overflow-hidden transition-all ${
      enabled ? "border-border bg-card" : "border-border/50 bg-card/50"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${skill.bg}`}>
          <Icon className={`w-5 h-5 ${skill.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold ${!enabled && "text-muted-foreground"}`}>{skill.label}</p>
            {skill.danger && <span className="text-[10px] bg-red-500/15 text-red-500 px-1.5 py-0.5 rounded font-medium">Gefährlich</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{skill.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setOpen(o => !o)} className="text-muted-foreground/50 hover:text-muted-foreground p-1">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <Switch checked={!!enabled} onCheckedChange={onToggle} disabled={loading} />
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 bg-secondary/30">
          <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Beispiele</p>
          <div className="space-y-1">
            {skill.examples.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary/50 flex-shrink-0" />
                {ex}
              </div>
            ))}
          </div>
          {skill.danger && (
            <p className="text-xs text-red-500 mt-2 leading-relaxed">
              ⚠️ Dieser Skill erlaubt dem Agenten Server-Zugriff. Nur aktivieren wenn du weißt was du tust.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BuiltinSkillCard({ skill }) {
  const Icon = skill.icon;
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${skill.bg}`}>
          <Icon className={`w-5 h-5 ${skill.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{skill.label}</p>
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Immer aktiv</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{skill.desc}</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground/50 hover:text-muted-foreground p-1 flex-shrink-0">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 bg-secondary/30">
          <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Beispiele</p>
          <div className="space-y-1">
            {skill.examples.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary/50 flex-shrink-0" />
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentScreen() {
  const [awake, setAwake] = useState(false);
  const [status, setStatus] = useState("Schläft...");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState({ lastRun: null, results: {}, running: false });
  const [jobsLoading, setJobsLoading] = useState(false);
  const [tab, setTab] = useState("agent");
  const [postfach, setPostfach] = useState([]);
  const [postfachLoading, setPostfachLoading] = useState(false);
  const [perms, setPerms] = useState({ shell: false, web: false, fileSystem: false, git: false });
  const [permsLoading, setPermsLoading] = useState(false);

  const token = () => localStorage.getItem("kimi_token") || "";

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgentStatus();
      setAwake(data.awake ?? false);
      setStatus(data.status || (data.awake ? "Bereit" : "Schläft..."));
    } catch {
      setStatus("Verbindung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetch("/api/agent/jobs", {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setJobs(data);
    } catch {} finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchPostfach = useCallback(async () => {
    setPostfachLoading(true);
    try {
      const res = await fetch("/api/agent/postfach", {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setPostfach(data.entries || []);
    } catch {} finally {
      setPostfachLoading(false);
    }
  }, []);

  const fetchPerms = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/permissions", { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setPerms(data);
    } catch {}
  }, []);

  const togglePerm = async (key) => {
    const next = { ...perms, [key]: !perms[key] };
    setPerms(next);
    setPermsLoading(true);
    try {
      await fetch("/api/agent/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ [key]: next[key] })
      });
    } catch { setPerms(perms); }
    finally { setPermsLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    fetchJobs();
    fetchPerms();
  }, [fetchStatus, fetchJobs, fetchPerms]);

  const toggleAgent = async () => {
    const newState = !awake;
    setAwake(newState);
    setStatus(newState ? "Wird gestartet..." : "Wird gestoppt...");
    try {
      await sendAgentTask({ action: newState ? "wake" : "sleep" });
      setStatus(newState ? "Aktiv" : "Schläft...");
    } catch {
      setAwake(!newState);
      setStatus("Fehler beim Umschalten");
    }
  };

  const triggerCrawl = async () => {
    setJobsLoading(true);
    try {
      await fetch("/api/agent/jobs/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` }
      });
      setTimeout(fetchJobs, 3000);
    } catch {} finally {
      setJobsLoading(false);
    }
  };

  const deletePostfachEntry = async (id) => {
    setPostfach(prev => prev.filter(e => String(e.id) !== String(id)));
    try {
      await fetch(`/api/agent/postfach/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("kimi_token")}` } });
    } catch {}
  };

  const deleteReadEntries = async () => {
    setPostfach(prev => prev.filter(e => !e.read));
    try {
      await fetch("/api/agent/postfach", { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("kimi_token")}` } });
    } catch {}
  };

  const markPostfachRead = async (id) => {
    setPostfach(prev => prev.map(e => String(e.id) === String(id) ? { ...e, read: true } : e));
    try {
      await fetch(`/api/agent/postfach/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` }
      });
    } catch {}
  };

  const [copied, setCopied] = useState(false);

  // Parse "Titel: ...\nURL: ...\nBeschreibung: ..." blocks into rows
  const parseJobBlocks = (content, profileLabel) => {
    const rows = [];
    const blocks = (content || "").split("---").map(b => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const titel = block.match(/Titel:\s*(.+)/)?.[1]?.trim() || "";
      const url   = block.match(/URL:\s*(\S+)/)?.[1]?.trim() || "";
      const desc  = block.match(/Beschreibung:\s*(.+)/s)?.[1]?.trim().slice(0, 200) || "";
      if (titel || url) rows.push([titel, "", "", "", url, new Date().toLocaleDateString("de-DE"), profileLabel, desc]);
    }
    return rows;
  };

  const buildRows = () => {
    const profiles = Object.values(jobs.results || {});
    const rows = [["Stelle", "Unternehmen", "Ort", "Remote", "Link", "Datum", "Profil", "Beschreibung"]];
    for (const profile of profiles) {
      rows.push(...parseJobBlocks(profile.content, profile.label || ""));
    }
    return rows;
  };

  const copyToClipboard = async () => {
    const rows = buildRows();
    const tsv = rows.map(row =>
      row.map(cell => String(cell || "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")
    ).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const exportCSV = () => {
    const rows = buildRows();
    // RFC 4180 CSV mit Anführungszeichen — Google Sheets + Excel (Import) kompatibel
    const csv = rows.map(row =>
      row.map(cell => `"${String(cell || "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`)
        .join(",")
    ).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const jobProfiles = Object.entries(jobs.results || {});
  const unreadCount = postfach.filter(e => !e.read).length;

  return (
    <div className="flex flex-col h-full pb-20 md:pb-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 safe-top">
        <h1 className="text-2xl font-bold tracking-tight">Agent</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Remote KI-Agent steuern</p>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-2 mb-3 bg-secondary rounded-xl p-1 gap-1">
        <button onClick={() => setTab("agent")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${tab === "agent" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Agent
        </button>
        <button onClick={() => { setTab("skills"); fetchPerms(); }}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${tab === "skills" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Skills
        </button>
        <button onClick={() => { setTab("jobs"); fetchJobs(); }}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${tab === "jobs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Jobs {jobProfiles.length > 0 && `(${jobProfiles.length})`}
        </button>
        <button onClick={() => { setTab("postfach"); fetchPostfach(); }}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors relative ${tab === "postfach" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Postfach
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {tab === "agent" && (
        <>
          {/* Agent Status Card */}
          <div className="mx-4 bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${awake ? "bg-emerald-500/15" : "bg-destructive/15"}`}>
                  <Bot className={`w-7 h-7 ${awake ? "text-success" : "text-destructive"}`} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">ESO Bot Agent</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${awake ? "bg-success" : "bg-destructive"}`} />
                    <span className="text-sm text-muted-foreground">{status}</span>
                  </div>
                </div>
              </div>
              <button onClick={toggleAgent}
                className={`min-w-[56px] min-h-[56px] rounded-2xl flex items-center justify-center transition-all active:scale-90 ${awake ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                <Power className="w-6 h-6" />
              </button>
            </div>
            <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm text-center font-medium ${awake ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
              {awake ? "🟢 Agent ist aktiv und hört zu" : "🔴 Agent schläft"}
            </div>
          </div>

          <button onClick={fetchStatus} disabled={loading}
            className="mx-4 mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-sm text-muted-foreground min-h-[44px] active:opacity-70">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Status aktualisieren
          </button>
        </>
      )}

      {tab === "skills" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 mb-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Skills geben dem Agenten spezifische Fähigkeiten. Aktiviere nur was du brauchst — die KI weiß dann was sie tun kann und nutzt es automatisch.
            </p>
          </div>

          {/* Aktivierbare Skills */}
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aktivierbare Skills</p>
          {SKILLS.map(skill => (
            <SkillCard
              key={skill.key}
              skill={skill}
              enabled={perms[skill.key]}
              onToggle={() => togglePerm(skill.key)}
              loading={permsLoading}
            />
          ))}

          {/* Immer aktive Skills */}
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Immer aktiv</p>
          {BUILTIN_SKILLS.map((skill, i) => (
            <BuiltinSkillCard key={i} skill={skill} />
          ))}

          <div className="h-6" />
        </div>
      )}

      {tab === "jobs" && (
        <div className="flex-1 overflow-y-auto">
          {/* Header row */}
          <div className="flex items-center justify-between px-4 mb-3">
            <p className="text-xs text-muted-foreground">
              {jobs.lastRun ? `Zuletzt: ${new Date(jobs.lastRun).toLocaleString("de-DE")}` : "Noch kein Durchlauf"}
            </p>
            <div className="flex gap-2">
              {jobProfiles.length > 0 && (<>
                <button onClick={copyToClipboard}
                  title="Tab-getrennte Daten kopieren — direkt in Excel/Google Sheets einfügen"
                  className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium active:opacity-70">
                  {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Kopiert!" : "Kopieren"}
                </button>
                <button onClick={exportCSV}
                  title="CSV-Datei herunterladen"
                  className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium active:opacity-70">
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </>)}
              <button onClick={fetchJobs} disabled={jobsLoading}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${jobsLoading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={triggerCrawl} disabled={jobsLoading || jobs.running}
                className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-primary/15 text-primary text-sm font-medium active:opacity-70">
                <Play className="w-3.5 h-3.5" />
                Jetzt suchen
              </button>
            </div>
          </div>

          {jobs.running && (
            <div className="mx-4 mb-3 flex items-center gap-2 px-4 py-3 bg-primary/10 rounded-xl">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              <p className="text-sm text-primary font-medium">Job-Crawler läuft...</p>
            </div>
          )}

          {jobProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <span className="text-3xl mb-2">💼</span>
              <p className="text-sm">Noch keine Ergebnisse</p>
              <p className="text-xs mt-1">Tippe auf "Jetzt suchen"</p>
            </div>
          ) : (
            jobProfiles.map(([id, profile]) => (
              <JobResultCard key={id} id={id} {...profile} />
            ))
          )}
        </div>
      )}

      {tab === "postfach" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-4 mb-3">
            <p className="text-xs text-muted-foreground">
              {postfach.length} {postfach.length === 1 ? "Nachricht" : "Nachrichten"}
              {unreadCount > 0 && ` · ${unreadCount} ungelesen`}
            </p>
            <div className="flex items-center gap-1">
              {postfach.some(e => e.read) && (
                <button onClick={deleteReadEntries} title="Gelesene löschen"
                  className="min-h-[44px] px-2 flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive active:opacity-70">
                  <Trash2 className="w-3.5 h-3.5" /> Gelesene löschen
                </button>
              )}
              <button onClick={fetchPostfach} disabled={postfachLoading}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${postfachLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {postfach.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Inbox className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Postfach ist leer</p>
              <p className="text-xs mt-1">Job-Ergebnisse erscheinen hier automatisch</p>
            </div>
          ) : (
            postfach.map(entry => (
              <PostfachEntry key={entry.id} entry={entry} onMarkRead={markPostfachRead} onDelete={deletePostfachEntry} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
