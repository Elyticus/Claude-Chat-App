import { useEffect, useState } from "react";
import { getScene, SCENES } from "@/lib/special-scenes.js";

// ─── Special mode — dynamic vector background ────────────────────────────────
// A macOS-style "Dynamic Desktop" done in SVG: the SAME layered-dune landscape,
// recoloured by the real clock into morning / afternoon / night (see
// special-scenes.js). Pure vector — gradients, a glowing sun/moon, three dune
// layers and (at night) stars. No canvas, no rAF loop, no CSS blur layers, so it
// is cheap to render and safe alongside the orbital nodes. It re-checks the clock
// each minute and re-renders when the scene flips at a time-of-day boundary.

const VW = 1440;
const VH = 900;

// Three layered dunes (back → front), defined once and recoloured per scene so it
// reads as one landscape under different light. Each closes down the sides/bottom.
const DUNES = [
  "M0,540 C 260,486 520,524 760,486 C 1000,450 1240,506 1440,458 L1440,900 L0,900 Z",
  "M0,648 C 300,600 560,660 820,620 C 1080,584 1300,636 1440,604 L1440,900 L0,900 Z",
  "M0,762 C 280,724 600,778 900,738 C 1160,704 1330,756 1440,728 L1440,900 L0,900 Z",
];

// Deterministic star field (stable positions, upper ~half of the sky).
const STARS = Array.from({ length: 64 }, (_, i) => ({
  x: ((i * 97.13) % 100) / 100,
  y: ((i * 37.7) % 44) / 100,
  r: 0.6 + ((i * 7) % 10) / 9,
  o: 0.35 + ((i * 13) % 10) / 16,
}));

// Lighten/darken a #rrggbb color by an integer amount for the dune base shade.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v));
  const r = c(((n >> 16) & 255) + amt);
  const g = c(((n >> 8) & 255) + amt);
  const b = c((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function SpecialField() {
  const [scene, setScene] = useState(() => getScene(new Date().getHours()));

  useEffect(() => {
    const id = setInterval(
      () => setScene(getScene(new Date().getHours())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  const p = SCENES[scene];
  const bx = p.body.cx * VW;
  const by = p.body.cy * VH;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sf-sky" x1="0" y1="0" x2="0" y2="1">
          {p.sky.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id="sf-glow">
          <stop offset="0%" stopColor={p.body.glow} stopOpacity="0.85" />
          <stop offset="40%" stopColor={p.body.glow} stopOpacity="0.3" />
          <stop offset="100%" stopColor={p.body.glow} stopOpacity="0" />
        </radialGradient>
        {p.dunes.map((c, i) => (
          <linearGradient key={i} id={`sf-dune-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={shade(c, -16)} />
          </linearGradient>
        ))}
      </defs>

      <rect width={VW} height={VH} fill="url(#sf-sky)" />

      {p.stars &&
        STARS.map((s, i) => (
          <circle key={i} cx={s.x * VW} cy={s.y * VH} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}

      {/* Soft halo, then the sun/moon disc (drawn before the dunes so it can rise
          from behind them). */}
      <circle cx={bx} cy={by} r={p.body.r * 3.6} fill="url(#sf-glow)" />
      <circle cx={bx} cy={by} r={p.body.r} fill={p.body.core} />

      {DUNES.map((d, i) => (
        <path key={i} d={d} fill={`url(#sf-dune-${i})`} />
      ))}
    </svg>
  );
}
