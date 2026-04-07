import { useState, useEffect, useCallback } from "react";
import { Bot, Power, RefreshCw, Briefcase, Server, ExternalLink, Play } from "lucide-react";
import AgentTaskItem from "../components/agent/AgentTaskItem";
import { getAgentStatus, sendAgentTask, getJobs, triggerJobCrawl, getMonitorStatus } from "../lib/kimiApi";

function timeAgo(ts) {
  if (!ts) return "nie";
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export default function AgentScreen() {
  const [awake, setAwake] = useState(false);
  const [status, setStatus] = useState("Schläft...");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [jobsLastRun, setJobsLastRun] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Monitor
  const [monitor, setMonitor] = useState(null);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgentStatus();
      setAwake(data.awake ?? false);
      setStatus(data.status || (data.awake ? "Bereit" : "Schläft..."));
      setTasks(data.tasks || []);
    } catch {
      setStatus("Verbindung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const data = await getJobs();
      setJobs(data.jobs || []);
      setJobsLastRun(data.lastRun || null);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchMonitor = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const data = await getMonitorStatus();
      setMonitor(data);
    } catch {
      setMonitor(null);
    } finally {
      setMonitorLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchJobs();
    fetchMonitor();
  }, [fetchStatus, fetchJobs, fetchMonitor]);

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

  const handleCrawlNow = async () => {
    setJobsLoading(true);
    try {
      const data = await triggerJobCrawl();
      setJobs(data.jobs || []);
      setJobsLastRun(new Date().toISOString());
    } catch {}
    finally { setJobsLoading(false); }
  };

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 safe-top">
        <h1 className="text-2xl font-bold tracking-tight">Agent</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Remote KI-Agent steuern</p>
      </div>

      {/* Agent Status Card */}
      <div className="mx-4 mt-4 bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              awake ? "bg-emerald-500/15" : "bg-destructive/15"
            }`}>
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
          <button
            onClick={toggleAgent}
            className={`min-w-[56px] min-h-[56px] rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
              awake ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            <Power className="w-6 h-6" />
          </button>
        </div>
        <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm text-center font-medium ${
          awake ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
        }`}>
          {awake ? "🟢 Agent ist aktiv und hört zu" : "🔴 Agent schläft"}
        </div>
      </div>

      {/* Server Monitor */}
      <div className="flex items-center justify-between px-4 mt-6 mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4" /> Server-Status
        </h3>
        <button onClick={fetchMonitor} disabled={monitorLoading}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${monitorLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mx-4 bg-card rounded-2xl border border-border p-4">
        {!monitor && !monitorLoading && (
          <p className="text-sm text-muted-foreground text-center py-2">Keine Verbindung</p>
        )}
        {monitorLoading && !monitor && (
          <div className="flex justify-center py-2">
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {monitor && (
          <div className="space-y-2">
            {/* Overall status */}
            <div className={`px-3 py-2 rounded-xl text-sm font-medium text-center ${
              monitor.allOk ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-400"
            }`}>
              {monitor.allOk ? "✅ Alle Services erreichbar" : "⚠️ Probleme erkannt"}
            </div>
            {/* Services */}
            {monitor.services?.map(svc => (
              <div key={svc.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{svc.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  svc.up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}>
                  {svc.up ? `HTTP ${svc.status}` : "Down"}
                </span>
              </div>
            ))}
            {/* Disk + RAM */}
            {monitor.disk?.usedPct !== null && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">💾 Disk</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  monitor.disk.ok ? "bg-secondary text-muted-foreground" : "bg-amber-500/15 text-amber-400"
                }`}>
                  {monitor.disk.usedPct}% ({monitor.disk.avail} frei)
                </span>
              </div>
            )}
            {monitor.memory?.usedPct !== null && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">🧠 RAM</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  monitor.memory.ok ? "bg-secondary text-muted-foreground" : "bg-amber-500/15 text-amber-400"
                }`}>
                  {monitor.memory.usedPct}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Jobs */}
      <div className="flex items-center justify-between px-4 mt-6 mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Jobs {jobsLastRun && <span className="font-normal normal-case">· {timeAgo(jobsLastRun)}</span>}
        </h3>
        <div className="flex gap-1">
          <button onClick={handleCrawlNow} disabled={jobsLoading}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
            <Play className={`w-4 h-4 text-muted-foreground ${jobsLoading ? "opacity-50" : ""}`} />
          </button>
          <button onClick={fetchJobs} disabled={jobsLoading}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${jobsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 mx-4">
        {jobs.length === 0 && !jobsLoading && (
          <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
            <span className="text-3xl mb-2">💼</span>
            <p className="text-sm">Keine Jobs — Crawler starten mit ▶</p>
          </div>
        )}
        {jobsLoading && jobs.length === 0 && (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="space-y-2 pb-4">
          {jobs.map((job, i) => (
            <a
              key={job.id || i}
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 bg-card rounded-2xl border border-border p-4 active:scale-[0.98] transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {job.company}{job.location ? ` · ${job.location}` : ""}
                  {job.remote ? " · 🏠 Remote" : ""}
                </p>
                {job.datePosted && (
                  <p className="text-xs text-muted-foreground/60 mt-1">{job.datePosted}</p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
            </a>
          ))}
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 mt-2 mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Aufgaben</h3>
            <button onClick={fetchStatus} disabled={loading}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="mx-4 space-y-2 pb-4">
            {tasks.map((task, i) => (
              <AgentTaskItem key={task.id || i} task={task} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
