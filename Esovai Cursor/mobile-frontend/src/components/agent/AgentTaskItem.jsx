import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const statusConfig = {
  running: { icon: Loader2, color: "text-primary", spin: true, label: "Läuft" },
  done: { icon: CheckCircle2, color: "text-success", spin: false, label: "Fertig" },
  error: { icon: AlertCircle, color: "text-destructive", spin: false, label: "Fehler" }
};

export default function AgentTaskItem({ task }) {
  const config = statusConfig[task.status] || statusConfig.running;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border/50">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className={`w-5 h-5 ${config.spin ? "animate-spin" : ""}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>
        {task.result && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.result}</p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">
        {new Date(task.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}