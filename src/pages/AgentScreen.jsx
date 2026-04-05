import { useState, useEffect, useCallback } from "react";
import { Bot, Power, RefreshCw } from "lucide-react";
import AgentTaskItem from "../components/agent/AgentTaskItem";
import { getAgentStatus, sendAgentTask } from "../lib/kimiApi";

export default function AgentScreen() {
  const [awake, setAwake] = useState(false);
  const [status, setStatus] = useState("Schläft...");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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

  return (
    <div className="flex flex-col h-full pb-20">
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
              <h2 className="font-semibold text-lg">KimiKimi Agent</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${awake ? "bg-success" : "bg-destructive"}`} />
                <span className="text-sm text-muted-foreground">{status}</span>
              </div>
            </div>
          </div>

          <button
            onClick={toggleAgent}
            className={`min-w-[56px] min-h-[56px] rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
              awake
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            <Power className="w-6 h-6" />
          </button>
        </div>

        {/* Status badge */}
        <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm text-center font-medium ${
          awake ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
        }`}>
          {awake ? "🟢 Agent ist aktiv und hört zu" : "🔴 Agent schläft"}
        </div>
      </div>

      {/* Tasks */}
      <div className="flex items-center justify-between px-4 mt-6 mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Aufgaben
        </h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <span className="text-3xl mb-2">📋</span>
            <p className="text-sm">Keine laufenden Aufgaben</p>
          </div>
        ) : (
          tasks.map((task, i) => (
            <AgentTaskItem key={task.id || i} task={task} />
          ))
        )}
      </div>
    </div>
  );
}