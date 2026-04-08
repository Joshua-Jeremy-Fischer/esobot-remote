import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    const keyRes = await fetch('/api/push/vapid-public-key');
    const { key } = await keyRes.json();
    if (!key) return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });

    const token = localStorage.getItem('kimi_token') || '';
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub),
    });
    console.log('[PWA] Push-Subscription registriert');
  } catch (e) {
    console.error('[PWA] Push-Setup fehlgeschlagen:', e.message);
  }
}

// Alte falsche Provider-Settings zurücksetzen
const s = localStorage.getItem('kimi_settings');
if (s) {
  try {
    const parsed = JSON.parse(s);
    if (parsed.provider === 'openai' || parsed.provider === 'anthropic' || parsed.provider === 'local') {
      localStorage.removeItem('kimi_settings');
    }
  } catch {}
}

registerPush();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
