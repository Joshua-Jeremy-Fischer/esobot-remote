import ReactMarkdown from "react-markdown";

export default function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-4 py-1`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mr-2 mt-auto mb-1">
          <span className="text-xs">🤖</span>
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-bl-sm"
        }`}
      >
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Attached"
            className="rounded-lg mb-2 max-h-48 w-auto"
          />
        )}
        <div className={`text-[15px] leading-relaxed prose prose-sm max-w-none ${
          isUser ? "prose-invert" : "prose-invert"
        }`}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <div className={`text-[10px] mt-1 ${
          isUser ? "text-primary-foreground/50" : "text-muted-foreground"
        }`}>
          {new Date(message.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}