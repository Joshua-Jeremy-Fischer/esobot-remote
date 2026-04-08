import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, BookmarkPlus, Check, Globe } from "lucide-react";

const TOKEN = () => localStorage.getItem("kimi_token") || "";

async function fetchInbox() {
  const r = await fetch("/api/agent/inbox", { headers: { Authorization: `Bearer ${TOKEN()}` } });
  if (!r.ok) return [];
  return (await r.json()).messages || [];
}

async function postToInbox(text, webMode = false) {
  const r = await fetch("/api/agent/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
    body: JSON.stringify({ content: text, webMode })
  });
  if (!r.ok) return [];
  return (await r.json()).messages || [];
}

async function saveToPostfach(title, content) {
  await fetch("/api/agent/postfach", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
    body: JSON.stringify({ title, content, type: "info" })
  });
}

function MessageBubble({ msg, isUser }) {
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const date = new Date(msg.timestamp).toLocaleDateString("de-DE");
    await saveToPostfach(`💬 Chat-Notiz (${date})`, msg.content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser && (
        <img
          src="https://media.base44.com/images/public/69d2b419042c20a2d77a9f12/efa5802c0_image.png"
          alt="ESO Bot"
          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mr-2 mt-auto mb-1"
        />
      )}
      <div className="flex flex-col gap-1 max-w-[82%]">
        <div className={`rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-bl-sm"
        }`}>
          <div className="text-[14px] leading-relaxed prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
          <div className={`text-[10px] mt-1 text-right ${isUser ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
            {new Date(msg.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        {!isUser && (
          <button
            onClick={handleSave}
            className="self-start flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary active:scale-95 transition-all px-1 py-0.5 rounded"
          >
            {saved
              ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Gespeichert!</span></>
              : <><BookmarkPlus className="w-3 h-3" /><span>Ins Postfach</span></>
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default function InboxScreen() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [webMode, setWebMode] = useState(true);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const load = useCallback(async () => {
    const msgs = await fetchInbox();
    setMessages(prev => JSON.stringify(prev) === JSON.stringify(msgs) ? prev : msgs);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      const msgs = await postToInbox(trimmed, webMode);
      if (msgs.length) setMessages(msgs);
      else await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/95 backdrop-blur-xl safe-top flex-shrink-0">
        <img
          src="https://media.base44.com/images/public/69d2b419042c20a2d77a9f12/efa5802c0_image.png"
          alt="ESO Bot"
          className="w-9 h-9 rounded-full object-cover"
        />
        <div>
          <h2 className="text-[15px] font-semibold">ESO Bot</h2>
          <p className="text-[11px] text-muted-foreground">
            {webMode ? "🌐 Web-Suche aktiv" : "Dein persönlicher KI-Assistent"}
          </p>
        </div>
      </div>

      {/* Messages — scrollable, paddingBottom für Input + BottomNav */}
      <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2" style={{ paddingBottom: "9rem" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center px-8 gap-4 pt-12">
            <img
              src="https://media.base44.com/images/public/69d2b419042c20a2d77a9f12/efa5802c0_image.png"
              alt="ESO Bot"
              className="w-20 h-20 rounded-full object-cover opacity-60"
            />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Hey! Ich bin ESO Bot 👋</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Schreib mir etwas — ich antworte sofort.<br />
                Job-Ergebnisse findest du unter Agent → Postfach.
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === "user";
          return (
            <MessageBubble key={msg.id} msg={msg} isUser={isUser} />
          );
        })}

        {sending && (
          <div className="flex justify-start items-end gap-2">
            <img
              src="https://media.base44.com/images/public/69d2b419042c20a2d77a9f12/efa5802c0_image.png"
              alt="ESO Bot"
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3 space-y-1">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              {webMode && <p className="text-[10px] text-muted-foreground">🌐 Sucht im Web...</p>}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — Mobile: fixed über BottomNav | Desktop: sticky am Seiten-Boden */}
      <div className="fixed bottom-14 left-0 right-0 md:static md:bottom-auto md:left-auto md:right-auto border-t border-border bg-card/95 backdrop-blur-xl px-3 py-2 md:py-3 flex items-end gap-2 z-40 max-w-lg md:max-w-none mx-auto md:mx-0">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Schreib ESO Bot..."
            rows={1}
            disabled={sending}
            className="w-full bg-secondary text-foreground rounded-2xl px-4 py-3 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[120px] overflow-y-auto resize-none"
          />
        </div>
        <button
          onClick={() => setWebMode(w => !w)}
          title={webMode ? "Web-Suche deaktivieren" : "Web-Suche aktivieren"}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all active:scale-95 flex-shrink-0 ${
            webMode ? "bg-blue-500 text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Globe className="w-5 h-5" />
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30 active:scale-95 transition-transform flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}
