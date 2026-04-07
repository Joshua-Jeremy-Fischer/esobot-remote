import { useState, useEffect, useCallback } from "react";
import { Inbox, Trash2, RefreshCw, CheckCheck } from "lucide-react";
import { getPostfach, markPostfachRead, deletePostfachEntry, deleteAllReadPostfach } from "../lib/kimiApi";

const TYPE_CONFIG = {
  alert:   { emoji: "🔴", bg: "bg-red-500/10",    border: "border-red-500/20",    text: "text-red-400" },
  warning: { emoji: "⚠️", bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-400" },
  jobs:    { emoji: "💼", bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400" },
  info:    { emoji: "ℹ️", bg: "bg-secondary",      border: "border-border",        text: "text-muted-foreground" },
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export default function PostfachScreen() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPostfach();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (entry) => {
    const id = entry.id;
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!entry.read) {
      try {
        await markPostfachRead(id);
        setEntries(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
      } catch {}
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deletePostfachEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
  };

  const handleClearRead = async () => {
    try {
      await deleteAllReadPostfach();
      setEntries(prev => prev.filter(e => !e.read));
    } catch {}
  };

  const unreadCount = entries.filter(e => !e.read).length;

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Postfach
              {unreadCount > 0 && (
                <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Agent-Nachrichten & Alerts</p>
          </div>
          <div className="flex gap-2">
            {entries.some(e => e.read) && (
              <button
                onClick={handleClearRead}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent transition-colors"
                title="Gelesene löschen"
              >
                <CheckCheck className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pt-2">
        {loading && entries.length === 0 && (
          <div className="flex justify-center pt-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Inbox className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Keine Nachrichten</p>
          </div>
        )}

        {entries.map(entry => {
          const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.info;
          const isOpen = expanded === entry.id;
          return (
            <div
              key={entry.id}
              onClick={() => handleExpand(entry)}
              className={`rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.98] ${cfg.bg} ${cfg.border} ${
                !entry.read ? "ring-1 ring-primary/30" : "opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold truncate ${!entry.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {entry.title}
                    </p>
                    {!entry.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(entry.timestamp)}</p>

                  {isOpen && (
                    <div className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-3">
                      {entry.content}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, entry.id)}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:bg-accent transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground/60" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
