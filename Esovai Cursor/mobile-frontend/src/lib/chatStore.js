const STORAGE_KEY = "kimi_chats";
const SETTINGS_KEY = "kimi_settings";

export function loadChats() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveChats(chats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function getChat(chatId) {
  const chats = loadChats();
  return chats.find(c => c.id === chatId) || null;
}

export function createChat(category = "Privat") {
  const chats = loadChats();
  const newChat = {
    id: crypto.randomUUID(),
    title: "Neuer Chat",
    category,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  chats.unshift(newChat);
  saveChats(chats);
  return newChat;
}

export function updateChat(chatId, updates) {
  const chats = loadChats();
  const idx = chats.findIndex(c => c.id === chatId);
  if (idx === -1) return null;
  chats[idx] = { ...chats[idx], ...updates, updatedAt: Date.now() };
  saveChats(chats);
  return chats[idx];
}

export function deleteChat(chatId) {
  const chats = loadChats().filter(c => c.id !== chatId);
  saveChats(chats);
}

export function addMessage(chatId, role, content, imageUrl) {
  const chat = getChat(chatId);
  if (!chat) return null;
  const msg = {
    id: crypto.randomUUID(),
    role,
    content,
    imageUrl: imageUrl || null,
    timestamp: Date.now()
  };
  chat.messages.push(msg);
  return updateChat(chatId, { messages: chat.messages });
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : {
    provider: "ollama",
    model: "kimi-k2.5:cloud",
    systemPrompt: "Du bist KimiKimi, ein hilfreicher KI-Assistent. Antworte auf Deutsch, klar und präzise.",
    darkMode: true,
    pushNotifications: false
  };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}