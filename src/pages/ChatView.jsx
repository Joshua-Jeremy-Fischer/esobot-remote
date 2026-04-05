import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getChat, addMessage, updateChat, deleteChat } from "../lib/chatStore";
import { sendChatMessage } from "../lib/kimiApi";
import { loadSettings } from "../lib/chatStore";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import ChatMenu from "../components/chat/ChatMenu";
import TypingIndicator from "../components/chat/TypingIndicator";

export default function ChatView() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const c = getChat(chatId);
    if (!c) {
      navigate("/");
      return;
    }
    setChat(c);
  }, [chatId, navigate]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.messages?.length, isTyping, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  }, []);

  const generateTitle = async (userMsg, assistantMsg) => {
    const short = userMsg.slice(0, 50);
    const title = short.length < userMsg.length ? short + "..." : short;
    const updated = updateChat(chatId, { title });
    if (updated) setChat(updated);
  };

  const handleSend = useCallback(async (text, imageUrl) => {
    if (!text && !imageUrl) return;

    const content = imageUrl ? `[Bild]\n${text}` : text;
    let updated = addMessage(chatId, "user", content, imageUrl);
    setChat(updated);
    setAutoScroll(true);
    setIsTyping(true);

    const settings = loadSettings();
    const messages = updated.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add system prompt
    const systemMessages = [
      { role: "system", content: settings.systemPrompt },
      ...messages
    ];

    try {
      const response = await sendChatMessage(systemMessages, settings.model);
      const reply = response?.choices?.[0]?.message?.content
        || response?.message?.content
        || response?.response
        || response?.content
        || "Keine Antwort erhalten.";
      
      updated = addMessage(chatId, "assistant", reply);
      setChat(updated);

      // Auto-title after first exchange
      if (updated.messages.length === 2 && updated.title === "Neuer Chat") {
        generateTitle(text, reply);
      }
    } catch (err) {
      updated = addMessage(chatId, "assistant", `⚠️ Fehler: ${err.message}`);
      setChat(updated);
    } finally {
      setIsTyping(false);
    }
  }, [chatId]);

  const handleRename = (newTitle) => {
    const updated = updateChat(chatId, { title: newTitle });
    if (updated) setChat(updated);
  };

  const handleDelete = () => {
    deleteChat(chatId);
    navigate("/");
  };

  const handleExport = () => {
    if (!chat) return;
    const text = chat.messages.map(m =>
      `[${m.role === "user" ? "Du" : "KimiKimi"}] ${m.content}`
    ).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chat.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!chat) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border bg-card/95 backdrop-blur-xl safe-top">
        <button
          onClick={() => navigate("/")}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-accent transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold truncate">{chat.title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {isTyping ? "Schreibt..." : `${chat.messages.length} Nachrichten`}
          </p>
        </div>
        <ChatMenu
          chat={chat}
          onRename={handleRename}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-3"
      >
        {chat.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8">
            <span className="text-5xl mb-4">🤖</span>
            <h3 className="text-lg font-semibold text-foreground">KimiKimi</h3>
            <p className="text-sm text-center mt-2">
              Hey! Wie kann ich dir helfen? Schreib mir eine Nachricht oder nutze die Quick-Actions.
            </p>
          </div>
        )}
        {chat.messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}