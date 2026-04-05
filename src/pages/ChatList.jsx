import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronDown } from "lucide-react";
import ProviderSheet, { getActiveProvider, getActiveModel } from "../components/chat/ProviderSheet";
import { loadChats, createChat } from "../lib/chatStore";
import ChatListItem from "../components/chat/ChatListItem";

export default function ChatList() {
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState(getActiveProvider());
  const [activeModel, setActiveModel] = useState(getActiveModel());
  const navigate = useNavigate();

  const handleProviderClose = () => {
    setProviderOpen(false);
    setActiveProvider(getActiveProvider());
    setActiveModel(getActiveModel());
  };

  useEffect(() => {
    setChats(loadChats());
  }, []);

  const handleNewChat = () => {
    const chat = createChat("Privat");
    navigate(`/chat/${chat.id}`);
  };

  const filtered = chats.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 safe-top">
        <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
        <button
          onClick={() => setProviderOpen(true)}
          className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5 active:text-foreground transition-colors"
        >
          <span>{activeProvider.label}{activeModel?.id ? ` · ${activeModel.label}` : ""}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chat suchen..."
            className="w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <span className="text-4xl mb-3">💭</span>
            <p className="text-sm">Noch keine Chats</p>
            <p className="text-xs mt-1">Starte jetzt deinen ersten Chat</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(chat => (
              <ChatListItem key={chat.id} chat={chat} />
            ))}
          </div>
        )}
      </div>

      {/* Floating New Chat Button */}
      <button
        onClick={handleNewChat}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/25 flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      <ProviderSheet open={providerOpen} onClose={handleProviderClose} />
    </div>
  );
}