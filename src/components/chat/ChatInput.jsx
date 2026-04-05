import { useState, useRef, useCallback } from "react";
import { Send, Camera } from "lucide-react";
import VoiceButton from "./VoiceButton";
import QuickActionChips from "./QuickActionChips";
import { base44 } from "@/api/base44Client";

export default function ChatInput({ onSend, disabled }) {
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
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
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
          onClick={() => fileInputRef.current?.click()}
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