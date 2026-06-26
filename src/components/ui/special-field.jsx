import { useEffect, useState } from "react";
import { getScene, SCENES } from "@/lib/special-scenes.js";

// ─── Special mode — dynamic landscape background (vector) ─────────────────────
// A macOS-style "Dynamic Desktop" in pure SVG + CSS: ONE stylised valley (layered
// mountains with a snow-capped peak, rolling hills, a winding river, scattered
// trees, a sun or moon) recoloured by the real clock into morning / afternoon /
// evening / night (see special-scenes.js). Geometry is fixed; only the palette
// changes. No canvas, no rAF loop, no CSS blur — cheap and safe behind the hub.
//
// Responsive by construction: the SKY is a full-bleed CSS gradient and the sun/
// moon/stars float in an absolutely-positioned sky layer, so they never crop.
// The scenery is a full-WIDTH band anchored to the bottom (h-44% on phones,
// h-70% on desktop) — phones get a tall sky + a full-width land strip, matching
// the portrait reference art; desktops get a taller landscape.
//
// Optional `palette` prop overrides the time-of-day scene with a custom one
// (e.g. an AI-generated Business background); falls back to the clock otherwise.

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v));
  const r = c(((n >> 16) & 255) + amt);
  const g = c(((n >> 8) & 255) + amt);
  const b = c((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Where the sun/moon sits per mood (percent of viewport — safely in the sky on
// both phone and desktop layouts), used by the vector fallback scene.
const ORB_POS = {
  morning: { x: 22, y: 24 },
  afternoon: { x: 24, y: 15 },
  evening: { x: 30, y: 26 },
  night: { x: 74, y: 15 },
};

// Deterministic star scatter across the upper sky (x, y as 0..1, r in px).
const STARS = Array.from({ length: 64 }, (_, i) => ({
  x: ((i * 97.13) % 100) / 100,
  y: ((i * 28.7) % 56) / 100,
  r: 0.7 + ((i * 7) % 10) / 7,
  o: 0.35 + ((i * 13) % 10) / 14,
}));

// Wispy contrail-style clouds (day/dawn/sunset).
const CLOUDS = [
  { left: 14, top: 16, w: 240, h: 16, rot: -8, o: 0.5 },
  { left: 52, top: 11, w: 300, h: 13, rot: -4, o: 0.4 },
  { left: 30, top: 26, w: 180, h: 12, rot: 6, o: 0.34 },
];

function Cypress({ x, y, s, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-2.4" y="-12" width="4.8" height="14" fill={shade(fill, -26)} />
      <path
        d="M0,2 C -10,-10 -9,-40 -6,-70 C -4,-92 -2,-104 0,-120 C 2,-104 4,-92 6,-70 C 9,-40 10,-10 0,2 Z"
        fill={fill}
      />
    </g>
  );
}

function RoundTree({ x, y, s, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3.4" y="-30" width="6.8" height="32" fill={shade(fill, -34)} />
      <circle cx="-16" cy="-44" r="17" fill={shade(fill, -10)} />
      <circle cx="15" cy="-46" r="16" fill={shade(fill, -4)} />
      <circle cx="0" cy="-56" r="22" fill={fill} />
    </g>
  );
}

// ─── Time-of-day illustration backgrounds (Pro) ──────────────────────────────
// The provided illustration art, one per period × orientation, served from
// /public/special. If a file is missing (e.g. assets not added yet) we fall back
// to the vector scene below, so Special mode never breaks.
const IMAGES = {
  morning: {
    landscape: "/special/morning-landscape.svg",
    portrait: "/special//morning-portrait.svg",
  },
  afternoon: {
    landscape: "/special/afternoon-landscape.svg",
    portrait: "/special/afternoon-portrait.svg",
  },
  evening: {
    landscape: "/special/evening-landscape.svg",
    portrait: "/special/evening-portrait.svg",
  },
  night: {
    landscape: "/special/night-landscape.svg",
    portrait: "/special/night-portrait.svg",
  },
};

// Track portrait vs landscape so phones get the tall art and desktops the wide.
function useOrientation() {
  const [portrait, setPortrait] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(orientation: portrait)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(orientation: portrait)");
    const on = (e) => setPortrait(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return portrait;
}

// The vector landscape — a graceful fallback for the time-of-day illustrations
// and the renderer for a Business AI-generated custom palette.
function VectorScene({ p, name }) {
  const [mFar, mMid, mNear] = p.mountains;
  const [hBack, hMid, hFront] = p.hills;
  const [water, sheen] = p.river;
  const isMoon = !!p.stars;
  const pos = ORB_POS[name] || ORB_POS.afternoon;

  const skyGradient = `linear-gradient(to bottom, ${p.sky
    .map(([o, c]) => `${c} ${Math.round(o * 100)}%`)
    .join(", ")})`;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Sky — full-bleed gradient, never cropped */}
      <div className="absolute inset-0" style={{ background: skyGradient }} />

      {/* Stars (night) */}
      {p.stars &&
        STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(s.x * 100).toFixed(2)}%`,
              top: `${(s.y * 60).toFixed(2)}%`,
              width: `${s.r}px`,
              height: `${s.r}px`,
              opacity: s.o,
            }}
          />
        ))}

      {/* Wispy clouds (day / dawn / sunset) */}
      {p.clouds &&
        CLOUDS.map((c, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              width: `${c.w}px`,
              height: `${c.h}px`,
              maxWidth: "40vw",
              background: p.clouds,
              opacity: c.o,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}

      {/* Sun / moon */}
      <span
        className="absolute rounded-full"
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: isMoon
            ? "clamp(46px, 6vw, 92px)"
            : "clamp(56px, 7.5vw, 116px)",
          height: isMoon
            ? "clamp(46px, 6vw, 92px)"
            : "clamp(56px, 7.5vw, 116px)",
          background: isMoon
            ? `radial-gradient(circle at 38% 34%, #ffffff, ${p.orb} 58%, ${shade(p.orb, -22)} 100%)`
            : `radial-gradient(circle at 50% 50%, #ffffff 8%, ${p.orb} 62%)`,
          boxShadow: isMoon
            ? `0 0 42px 2px ${p.orbGlow || "rgba(200,214,255,0.45)"}`
            : `0 0 64px 8px ${p.orbGlow || "rgba(255,240,200,0.5)"}`,
        }}
      />

      {/* Scenery — full-width band anchored to the bottom. Phones show a short
          full-width strip (tall sky above); desktop shows a taller landscape. */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-[44%] sm:h-[70%]"
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="sf-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sheen} />
            <stop offset="100%" stopColor={water} />
          </linearGradient>
        </defs>

        {/* Mountains — three receding ridges, far = hazy */}
        <path
          d="M0,180 L120,150 L280,170 L430,140 L600,165 L760,135 L920,158 L1080,128 L1240,160 L1400,140 L1600,165 L1600,600 L0,600 Z"
          fill={mFar}
          opacity="0.85"
        />
        <path
          d="M0,200 L160,176 L340,150 L520,186 L700,150 L880,124 L1040,152 L1180,172 L1360,150 L1600,186 L1600,600 L0,600 Z"
          fill={mMid}
        />
        {/* Prominent snow-capped peak */}
        <path
          d="M0,216 L240,196 L470,206 L700,176 L860,150 L1010,58 L1170,150 L1330,190 L1520,206 L1600,212 L1600,600 L0,600 Z"
          fill={mNear}
        />
        <path
          d="M1010,60 L1050,116 L1034,108 L1020,122 L1006,112 L992,122 L978,108 L970,116 Z"
          fill={p.snow}
        />

        {/* Rolling hills — receding bands */}
        <path
          d="M0,205 C 260,165 520,205 820,180 C 1080,160 1340,205 1600,185 L1600,600 L0,600 Z"
          fill={hBack}
        />
        <path
          d="M0,300 C 280,255 560,305 860,280 C 1120,258 1380,310 1600,288 L1600,600 L0,600 Z"
          fill={hMid}
        />

        {/* Winding river — emerges from the valley and snakes to the foreground */}
        <path
          d="M 858,296 C 792,348 742,360 766,408 C 788,452 862,452 826,506 C 798,548 700,556 706,600"
          fill="none"
          stroke="url(#sf-river)"
          strokeWidth="46"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 858,296 C 792,348 742,360 766,408 C 788,452 862,452 826,506 C 798,548 700,556 706,600"
          fill="none"
          stroke={sheen}
          strokeWidth="14"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Nearest hills frame the valley so the river runs between them */}
        <path
          d="M0,430 C 180,392 360,420 520,452 C 600,468 642,500 660,600 L0,600 Z"
          fill={hFront}
        />
        <path
          d="M1600,440 C 1420,400 1240,424 1080,452 C 980,470 902,500 884,600 L1600,600 Z"
          fill={hFront}
        />

        {/* Trees — cypress cluster left, round trees right, a few mid for depth */}
        <Cypress x={112} y={452} s={0.95} fill={p.trees} />
        <Cypress x={158} y={440} s={1.15} fill={p.trees} />
        <Cypress x={206} y={460} s={0.85} fill={p.trees} />
        <RoundTree x={556} y={470} s={0.92} fill={p.trees} />
        <RoundTree x={1180} y={470} s={1.1} fill={p.trees} />
        <RoundTree x={1316} y={452} s={0.9} fill={p.trees} />
        <RoundTree x={1460} y={478} s={1.05} fill={p.trees} />
        <Cypress x={988} y={486} s={1.0} fill={p.trees} />
        {/* Small far trees on the mid hill for depth */}
        <RoundTree x={360} y={300} s={0.5} fill={shade(p.trees, 8)} />
        <RoundTree x={1240} y={300} s={0.5} fill={shade(p.trees, 8)} />
      </svg>
    </div>
  );
}

export default function SpecialField({ treatment = null }) {
  const [scene, setScene] = useState(() => getScene(new Date().getHours()));
  const [failedSrc, setFailedSrc] = useState(null);
  const portrait = useOrientation();

  useEffect(() => {
    const id = setInterval(
      () => setScene(getScene(new Date().getHours())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  // The live time-of-day illustration (orientation-aware); the vector scene is a
  // fallback if the image is missing or fails to load.
  const src = IMAGES[scene][portrait ? "portrait" : "landscape"];
  const showVector = failedSrc === src;

  // A Business AI "background" is a colour-GRADE applied ON TOP of the real photo
  // (CSS filters + a tint overlay) — it recolours the actual scene rather than
  // replacing it.
  const filter = treatment
    ? `hue-rotate(${treatment.hueRotate}deg) saturate(${treatment.saturate}) brightness(${treatment.brightness}) contrast(${treatment.contrast})`
    : undefined;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ background: SCENES[scene].sky[0][1] }}
    >
      {showVector ? (
        <div className="absolute inset-0" style={{ filter }}>
          <VectorScene p={SCENES[scene]} name={scene} />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center", filter }}
        />
      )}
      {treatment && treatment.overlayOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: treatment.overlay,
            mixBlendMode: treatment.blend,
            opacity: treatment.overlayOpacity,
          }}
        />
      )}
    </div>
  );
}
