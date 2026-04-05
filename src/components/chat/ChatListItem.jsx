import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { deleteChat } from "../../lib/chatStore";

const categoryColors = {
  Arbeit: "bg-blue-500/20 text-blue-400",
  Privat: "bg-emerald-500/20 text-emerald-400",
  Code: "bg-purple-500/20 text-purple-400"
};

export default function ChatListItem({ chat, onDelete }) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const navigate = useNavigate();

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dy > 10) return; // vertical scroll dominates
    if (dx < 0) setSwipeX(Math.max(dx, -80));
    else if (swiped) setSwipeX(Math.min(dx - 80, 0));
  };

  const handleTouchEnd = () => {
    if (swipeX < -50) {
      setSwipeX(-80);
      setSwiped(true);
    } else {
      setSwipeX(0);
      setSwiped(false);
    }
  };

  const handleDelete = (e) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(50);
    deleteChat(chat.id);
    onDelete?.(chat.id);
  };

  const handleClick = (e) => {
    if (swiped) {
      e.preventDefault();
      setSwipeX(0);
      setSwiped(false);
    } else {
      navigate(`/chat/${chat.id}`);
    }
  };
  const lastMsg = chat.messages?.[chat.messages.length - 1];
  const snippet = lastMsg?.content?.slice(0, 60) || "Noch keine Nachrichten";
  const time = chat.updatedAt
    ? new Date(chat.updatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const colorClass = categoryColors[chat.category] || categoryColors.Privat;

  return (
    <div className="relative overflow-hidden">
      {/* Delete action behind */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-destructive flex items-center justify-center">
        <button onClick={handleDelete} className="w-full h-full flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Swipeable row */}
      <div
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 || swipeX === -80 ? "transform 0.2s" : "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="flex items-center gap-3 px-4 py-3.5 bg-background active:bg-accent transition-colors min-h-[72px] relative z-10 cursor-pointer"
      >
        <img
          src="https://media.base44.com/images/public/69d2b419042c20a2d77a9f12/efa5802c0_image.png"
          alt="ESO Bot"
          className="w-11 h-11 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold truncate">{chat.title}</h3>
            <span className="text-[11px] text-muted-foreground flex-shrink-0">{time}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[13px] text-muted-foreground truncate flex-1">{snippet}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colorClass}`}>
              {chat.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}