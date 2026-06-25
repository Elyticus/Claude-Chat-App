import { useEffect, useState } from "react";
import { getScene, SCENES } from "@/lib/special-scenes.js";

// ─── Special mode — dynamic coastal background (vector) ──────────────────────
// A macOS-style "Dynamic Desktop" in pure SVG: ONE stylised coastline recoloured
// by the real clock into morning / afternoon / night (see special-scenes.js).
// Geometry is fixed; only the palette changes. No canvas, no rAF loop, no CSS
// blur — just gradients and paths, so it is cheap and safe behind the orbital
// nodes. Re-checks the clock each minute and re-renders when the scene flips.
//
// Optional `palette` prop overrides the time-of-day scene with a custom one
// (e.g. an AI-generated Business background); falls back to the clock otherwise.

const VW = 1600;
const VH = 900;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v));
  const r = c(((n >> 16) & 255) + amt);
  const g = c(((n >> 8) & 255) + amt);
  const b = c((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: ((i * 97.13) % 100) / 100,
  y: ((i * 31.7) % 34) / 100,
  r: 0.6 + ((i * 7) % 10) / 9,
  o: 0.4 + ((i * 13) % 10) / 16,
}));

function Tree({ x, y, s, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-2.5,0 L2.5,0 L1.5,-56 L-1.5,-56 Z" fill={fill} />
      <ellipse cx="0" cy="-72" rx="36" ry="13" fill={fill} />
      <ellipse cx="0" cy="-63" rx="52" ry="15" fill={fill} />
      <ellipse cx="-24" cy="-56" rx="30" ry="12" fill={fill} />
      <ellipse cx="26" cy="-58" rx="28" ry="11" fill={fill} />
    </g>
  );
}

function Grass({ x, y, s, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={fill} strokeWidth="3.4" strokeLinecap="round" fill="none">
      <path d="M0,0 C -2,-15 -6,-24 -11,-30" />
      <path d="M0,0 C 0,-17 0,-28 0,-36" />
      <path d="M0,0 C 2,-15 6,-24 11,-30" />
      <path d="M0,0 C 5,-12 9,-19 13,-24" />
    </g>
  );
}

function Flower({ x, y, s, petal, stem }) {
  const pet = [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180;
    return { cx: Math.cos(r) * 9, cy: -90 + Math.sin(r) * 9 };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,0 C -4,-34 -3,-64 0,-90" stroke={stem} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <ellipse cx="-11" cy="-44" rx="10" ry="4.5" fill={stem} transform="rotate(-32 -11 -44)" />
      <ellipse cx="11" cy="-32" rx="10" ry="4.5" fill={stem} transform="rotate(32 11 -32)" />
      {pet.map((q, i) => (
        <circle key={i} cx={q.cx} cy={q.cy} r="7.5" fill={petal} />
      ))}
      <circle cx="0" cy="-90" r="4.5" fill={shade(petal, -55)} />
    </g>
  );
}

export default function SpecialField({ palette = null }) {
  const [scene, setScene] = useState(() => getScene(new Date().getHours()));

  useEffect(() => {
    if (palette) return; // custom palette: no clock ticking
    const id = setInterval(() => setScene(getScene(new Date().getHours())), 60000);
    return () => clearInterval(id);
  }, [palette]);

  const p = palette || SCENES[scene];
  const [cFar, cMid, cNear] = p.cliffs;
  const [rockFace, rockShade] = p.rock;

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
        <linearGradient id="sf-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sea[0]} />
          <stop offset="100%" stopColor={p.sea[1]} />
        </linearGradient>
        <linearGradient id="sf-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sand[0]} />
          <stop offset="100%" stopColor={p.sand[1]} />
        </linearGradient>
        <linearGradient id="sf-cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cNear} />
          <stop offset="100%" stopColor={shade(cNear, -14)} />
        </linearGradient>
        <linearGradient id="sf-rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rockFace} />
          <stop offset="100%" stopColor={rockShade} />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width={VW} height={372} fill="url(#sf-sky)" />
      {p.stars &&
        STARS.map((s, i) => (
          <circle key={i} cx={s.x * VW} cy={s.y * VH} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}

      {/* Far hazy cape on the horizon */}
      <path d="M1040,338 C1150,308 1270,316 1380,338 L1380,372 L1040,372 Z" fill={cFar} opacity="0.8" />

      {/* Sea */}
      <rect y="338" width={VW} height={232} fill="url(#sf-sea)" />

      {/* Foam where the sea meets the sand */}
      <path
        d="M0,512 C 300,494 580,542 900,512 C 1150,488 1400,532 1600,508 L1600,552 C 1360,576 1120,540 900,562 C 580,590 300,544 0,564 Z"
        fill={p.foam}
        opacity="0.92"
      />

      {/* Beach */}
      <path d="M0,548 C 300,530 580,578 900,548 C 1150,524 1400,568 1600,544 L1600,900 L0,900 Z" fill="url(#sf-sand)" />

      {/* Right headland — three receding facets, near = darkest */}
      <path d="M1015,372 C 1095,250 1190,205 1255,205 L1255,372 Z" fill={cFar} />
      <path d="M1150,372 C 1230,210 1340,150 1430,140 L1430,372 Z" fill={cMid} />
      <path d="M1255,640 C 1255,430 1350,235 1500,150 L1600,110 L1600,640 Z" fill="url(#sf-cliff)" />
      {/* cliff edge highlight */}
      <path d="M1500,150 L1600,110 L1600,210 L1520,240 Z" fill={shade(cNear, 26)} opacity="0.7" />

      {/* Umbrella pines on the ridge */}
      <Tree x={1372} y={196} s={1.05} fill={p.foliage} />
      <Tree x={1268} y={250} s={0.78} fill={p.foliage} />

      {/* Foreground — big rock bottom-left */}
      <path d="M0,792 L96,720 L250,802 L300,900 L0,900 Z" fill="url(#sf-rock)" />
      <path d="M96,720 L250,802 L150,806 Z" fill={shade(rockFace, 22)} opacity="0.6" />

      {/* Scattered rocks on the sand */}
      <path d="M470,724 L520,700 L600,726 L582,760 L486,758 Z" fill={rockFace} />
      <path d="M700,690 L744,672 L806,694 L790,722 L708,720 Z" fill={shade(rockFace, -10)} />
      <path d="M980,756 L1040,730 L1130,758 L1108,796 L996,792 Z" fill={rockFace} />

      {/* Grass tufts */}
      <Grass x={300} y={764} s={1.5} fill={p.foliage} />
      <Grass x={642} y={742} s={1.3} fill={p.foliage} />
      <Grass x={1160} y={804} s={1.5} fill={p.foliage} />

      {/* Wildflowers, both lower corners */}
      <Flower x={250} y={862} s={1.05} petal={p.flowers[0]} stem={p.foliage} />
      <Flower x={310} y={892} s={0.9} petal={p.flowers[1]} stem={p.foliage} />
      <Flower x={188} y={898} s={0.82} petal={p.flowers[0]} stem={p.foliage} />
      <Flower x={1486} y={874} s={1.05} petal={p.flowers[1]} stem={p.foliage} />
      <Flower x={1556} y={900} s={0.92} petal={p.flowers[0]} stem={p.foliage} />
    </svg>
  );
}
