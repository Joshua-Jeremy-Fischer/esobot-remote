import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Bot, Settings } from "lucide-react";

const navItems = [
  { path: "/", icon: MessageSquare, label: "Chat" },
  { path: "/agent", icon: Bot, label: "Agent" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav() {
  const location = useLocation();

  // Hide nav in chat view
  if (location.pathname.startsWith("/chat/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center min-w-[80px] min-h-[56px] py-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.2 : 1.5} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}