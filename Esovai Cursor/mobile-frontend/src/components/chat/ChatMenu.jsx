import { useState } from "react";
import { MoreVertical, Pencil, Trash2, Download, X } from "lucide-react";

export default function ChatMenu({ chat, onRename, onDelete, onExport }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat?.title || "");

  const handleRename = () => {
    if (title.trim()) {
      onRename(title.trim());
      setRenaming(false);
      setOpen(false);
    }
  };

  if (renaming) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center px-6">
        <div className="bg-card rounded-2xl p-5 w-full max-w-sm border border-border">
          <h3 className="text-lg font-semibold mb-3">Chat umbenennen</h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setRenaming(false); setOpen(false); }}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium"
            >
              Abbrechen
            </button>
            <button
              onClick={handleRename}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent transition-colors"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden">
            <button
              onClick={() => setRenaming(true)}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-foreground active:bg-accent transition-colors"
            >
              <Pencil className="w-4 h-4" /> Umbenennen
            </button>
            <button
              onClick={() => { onExport(); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-foreground active:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" /> Exportieren
            </button>
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-destructive active:bg-accent transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Löschen
            </button>
          </div>
        </>
      )}
    </div>
  );
}