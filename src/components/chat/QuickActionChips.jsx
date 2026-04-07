const chips = [
  { label: "💼 Jobs suchen", text: "Suche aktuelle IT-Security Jobs für mich" },
  { label: "📝 Bewerbung", text: "Schreib eine Bewerbung für diese Stelle: " },
  { label: "🖥️ Server-Status", text: "Wie ist der aktuelle Status meiner Server?" },
  { label: "📬 Postfach", text: "Was sind die neuesten Einträge in meinem Postfach?" },
  { label: "🔍 Recherche", text: "Recherchiere für mich: " },
  { label: "✅ Ja", text: "Ja" },
  { label: "❌ Nein", text: "Nein" },
];

export default function QuickActionChips({ onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
      {chips.map(({ label, text }) => (
        <button
          key={label}
          onClick={() => onSelect(text)}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border/50 active:scale-95 transition-transform min-h-[36px]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
