import { userBg, initials } from "@/lib/helpers.js";

export function Avatar({
  userId,
  username,
  size = 100,
  online = false,
  avatar = null,
}) {
  const dotSize = Math.round(size * 0.28);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatar ? (
        <img
          src={avatar}
          alt={username}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            background: userBg(userId),
            width: size,
            height: size,
            fontSize: Math.round(size * 0.33),
          }}
        >
          {initials(username)}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full bg-emerald-400"
          style={{
            width: dotSize,
            height: dotSize,
            bottom: 1,
            right: 1,
            border: "2px solid #070d1c",
            boxShadow: "0 0 6px rgba(52,211,153,0.6)",
          }}
        />
      )}
    </div>
  );
}
