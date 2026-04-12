import { useState, useRef, useCallback } from "react";
import { Send, Camera, Globe, Hammer } from "lucide-react";
import VoiceButton from "./VoiceButton";
import QuickActionChips from "./QuickActionChips";

export default function ChatInput({ onSend, disabled, webMode, onWebModeToggle, buildMode, onBuildModeToggle }) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !imageUrl) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onSend(trimmed, imageUrl);
    setText("");
    setImageUrl(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, imageUrl, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("kimi_token") || "";
    const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await res.json();
    setImageUrl(data.url || data.file_url);
    setUploading(false);
  };

  const handleChip = (label) => {
    setText(prev => prev ? `${prev} ${label}` : label);
    textareaRef.current?.focus();
  };

  const handleVoiceTranscript = (transcript) => {
    setText(prev => prev ? `${prev} ${transcript}` : transcript);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-card/95 backdrop-blur-xl safe-bottom">
      <QuickActionChips onSelect={handleChip} />

      {imageUrl && (
        <div className="px-4 py-2">
          <div className="relative inline-block">
            <img src={imageUrl} alt="Preview" className="h-16 rounded-lg" />
            <button
              onClick={() => setImageUrl(null)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        <button
          onClick={() => { if (navigator.vibrate) navigator.vibrate(10); fileInputRef.current?.click(); }}
          disabled={uploading}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95 transition-transform"
        >
          <Camera className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          className="hidden"
        />

        <VoiceButton onTranscript={handleVoiceTranscript} />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht..."
            rows={1}
            className="w-full bg-secondary text-foreground rounded-2xl px-4 py-3 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[120px] overflow-y-auto"
          />
        </div>

        <button
          onClick={onWebModeToggle}
          title={webMode ? "Web Search aktiv" : "Web Search aktivieren"}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all active:scale-95 ${
            webMode ? "bg-blue-500 text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Globe className="w-5 h-5" />
        </button>

        <button
          onClick={onBuildModeToggle}
          title={buildMode ? "Build-Modus aktiv (Multi-Agent)" : "Build-Modus aktivieren"}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all active:scale-95 ${
            buildMode ? "bg-purple-500 text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Hammer className="w-5 h-5" />
        </button>

        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !imageUrl)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30 active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}