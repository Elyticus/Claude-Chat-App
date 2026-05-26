export function TypingIndicator({ names, isDark }) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.join(", ")} are typing`;
  return (
    <span
      className={`flex items-center gap-1 text-xs ${isDark ? "text-indigo-300/50" : "text-slate-400"}`}
    >
      {label}
      <span className="flex gap-0.5 items-end ml-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1 h-1 rounded-full animate-bounce ${isDark ? "bg-indigo-400/50" : "bg-slate-400"}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </span>
  );
}
