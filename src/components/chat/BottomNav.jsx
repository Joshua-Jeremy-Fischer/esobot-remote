import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Bot, Settings, Inbox } from "lucide-react";
import { getPostfach } from "../../lib/kimiApi";

export default function BottomNav() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll postfach unread count every 30s
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPostfach();
        const unread = (data.entries || []).filter(e => !e.read).length;
        setUnreadCount(unread);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Hide nav in chat view
  if (location.pathname.startsWith("/chat/")) return null;

  const navItems = [
    { path: "/", icon: MessageSquare, label: "Chat", badge: 0 },
    { path: "/postfach", icon: Inbox, label: "Postfach", badge: unreadCount },
    { path: "/agent", icon: Bot, label: "Agent", badge: 0 },
    { path: "/settings", icon: Settings, label: "Settings", badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center min-w-[72px] min-h-[56px] py-2 transition-colors relative ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={active ? 2.2 : 1.5} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
