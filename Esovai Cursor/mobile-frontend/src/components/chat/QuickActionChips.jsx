const chips = [
  "Code erklären",
  "Zusammenfassen",
  "Analysieren",
  "Ja",
  "Nein",
  "Später"
];

export default function QuickActionChips({ onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
      {chips.map(label => (
        <button
          key={label}
          onClick={() => onSelect(label)}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border/50 active:scale-95 transition-transform min-h-[36px]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}