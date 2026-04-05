import { Link } from "react-router-dom";

const categoryColors = {
  Arbeit: "bg-blue-500/20 text-blue-400",
  Privat: "bg-emerald-500/20 text-emerald-400",
  Code: "bg-purple-500/20 text-purple-400"
};

export default function ChatListItem({ chat }) {
  const lastMsg = chat.messages?.[chat.messages.length - 1];
  const snippet = lastMsg?.content?.slice(0, 60) || "Noch keine Nachrichten";
  const time = chat.updatedAt
    ? new Date(chat.updatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const colorClass = categoryColors[chat.category] || categoryColors.Privat;

  return (
    <Link
      to={`/chat/${chat.id}`}
      className="flex items-center gap-3 px-4 py-3.5 active:bg-accent transition-colors min-h-[72px]"
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
    </Link>
  );
}