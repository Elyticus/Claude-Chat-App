import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getScene, SCENES } from "@/lib/special-scenes.js";

// ─── Special mode — dynamic landscape background ───────────────────────────────
// Normal path: sky-colour background → photo from /public/special fades in.
// VectorScene is ONLY shown when a photo genuinely fails to load (404 / error).
//
// Parallax: spring physics (not linear lerp) drives --plx / --ply CSS custom
// properties on the container via a rAF loop — zero React re-renders.
//   Photo — 0.80 × X, 0.50 × Y, scale(1.06) covers the displaced edges
//   VectorScene sky — static  /  orb+clouds — 0.20×  /  scenery — 0.75× X
//
// "Already loaded" images are tracked in loadedSrcs (module-level Set), so
// switching scenes / orientation never flashes on a cache hit.

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v));
  const r = c(((n >> 16) & 255) + amt);
  const g = c(((n >> 8) & 255) + amt);
  const b = c((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const ORB_POS = {
  morning: { x: 22, y: 24 },
  afternoon: { x: 24, y: 15 },
  evening: { x: 30, y: 26 },
  night: { x: 74, y: 15 },
};

const STARS = Array.from({ length: 64 }, (_, i) => ({
  x: ((i * 97.13) % 100) / 100,
  y: ((i * 28.7) % 56) / 100,
  r: 0.7 + ((i * 7) % 10) / 7,
  o: 0.35 + ((i * 13) % 10) / 14,
}));

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
const IMAGES = {
  morning: {
    landscape: "/special/morning-landscape.jpg",
    portrait: "/special/morning-portrait.jpg",
  },
  afternoon: {
    landscape: "/special/afternoon-landscape.jpg",
    portrait: "/special/afternoon-portrait.jpg",
  },
  evening: {
    landscape: "/special/evening-landscape.jpg",
    portrait: "/special/evening-portrait.jpg",
  },
  night: {
    landscape: "/special/night-landscape.jpg",
    portrait: "/special/night-portrait.jpg",
  },
};

// Track which srcs have finished loading — persists across renders / scene switches.
const loadedSrcs = new Set();

// Kick off all 8 fetches at module parse time so the browser has a head-start.
Object.values(IMAGES)
  .flatMap((o) => Object.values(o))
  .forEach((s) => {
    const img = new Image();
    img.onload = () => loadedSrcs.add(s);
    img.src = s;
  });

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

// ─── Vector fallback — only shown when a photo fails to load ─────────────────
// Still has the parallax layers so it looks good as a real fallback, not a flash.
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
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky — static, always covers any gap */}
      <div className="absolute inset-0" style={{ background: skyGradient }} />

      {/* Distant: stars, clouds, orb — 20 % */}
      <div
        className="absolute inset-0"
        style={{
          transform:
            "translate(calc(var(--plx, 0px) * -0.2), calc(var(--ply, 0px) * -0.12))",
        }}
      >
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
      </div>

      {/* Scenery — 75 % horizontal only (no vertical = no bottom gap) */}
      <div
        className="absolute inset-0"
        style={{ transform: "translateX(calc(var(--plx, 0px) * -0.75))" }}
      >
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

          <path
            d="M0,180 L120,150 L280,170 L430,140 L600,165 L760,135 L920,158 L1080,128 L1240,160 L1400,140 L1600,165 L1600,600 L0,600 Z"
            fill={mFar}
            opacity="0.85"
          />
          <path
            d="M0,200 L160,176 L340,150 L520,186 L700,150 L880,124 L1040,152 L1180,172 L1360,150 L1600,186 L1600,600 L0,600 Z"
            fill={mMid}
          />
          <path
            d="M0,216 L240,196 L470,206 L700,176 L860,150 L1010,58 L1170,150 L1330,190 L1520,206 L1600,212 L1600,600 L0,600 Z"
            fill={mNear}
          />
          <path
            d="M1010,60 L1050,116 L1034,108 L1020,122 L1006,112 L992,122 L978,108 L970,116 Z"
            fill={p.snow}
          />

          <path
            d="M0,205 C 260,165 520,205 820,180 C 1080,160 1340,205 1600,185 L1600,600 L0,600 Z"
            fill={hBack}
          />
          <path
            d="M0,300 C 280,255 560,305 860,280 C 1120,258 1380,310 1600,288 L1600,600 L0,600 Z"
            fill={hMid}
          />

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

          <path
            d="M0,430 C 180,392 360,420 520,452 C 600,468 642,500 660,600 L0,600 Z"
            fill={hFront}
          />
          <path
            d="M1600,440 C 1420,400 1240,424 1080,452 C 980,470 902,500 884,600 L1600,600 Z"
            fill={hFront}
          />

          <Cypress x={112} y={452} s={0.95} fill={p.trees} />
          <Cypress x={158} y={440} s={1.15} fill={p.trees} />
          <Cypress x={206} y={460} s={0.85} fill={p.trees} />
          <RoundTree x={556} y={470} s={0.92} fill={p.trees} />
          <RoundTree x={1180} y={470} s={1.1} fill={p.trees} />
          <RoundTree x={1316} y={452} s={0.9} fill={p.trees} />
          <RoundTree x={1460} y={478} s={1.05} fill={p.trees} />
          <Cypress x={988} y={486} s={1.0} fill={p.trees} />
          <RoundTree x={360} y={300} s={0.5} fill={shade(p.trees, 8)} />
          <RoundTree x={1240} y={300} s={0.5} fill={shade(p.trees, 8)} />
        </svg>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// Memoized: OrbitalHub re-renders ~20×/sec to spin its bubbles; the special
// background only depends on `treatment`, so skip those rotation-tick renders.
function SpecialField({ treatment = null }) {
  const [scene, setScene] = useState(() => getScene(new Date().getHours()));
  const portrait = useOrientation();
  const [failedSrc, setFailedSrc] = useState(null);

  // Derived before the next useState so the initializer can check the cache.
  const src = IMAGES[scene][portrait ? "portrait" : "landscape"];
  const showVector = failedSrc === src;

  // Start ready if the image was already fetched (cache hit = no fade flash).
  const [photoReady, setPhotoReady] = useState(() => loadedSrcs.has(src));
  const containerRef = useRef(null);

  // Scene clock — re-check every minute.
  useEffect(() => {
    const id = setInterval(
      () => setScene(getScene(new Date().getHours())),
      60_000,
    );
    return () => clearInterval(id);
  }, []);

  // Sync photoReady whenever src changes (scene switch or orientation flip).
  // useLayoutEffect fires before the browser paints — cached images appear
  // instantly with no 1-frame opacity:0 flash.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotoReady(loadedSrcs.has(src));
  }, [src]);

  // Spring physics parallax — rAF loop updates --plx / --ply directly on the
  // DOM so no React re-renders occur. Spring gives a natural overshoot feeling
  // unlike a flat linear lerp.
  useEffect(() => {
    let rafId;
    let cx = 0,
      cy = 0; // current position (normalised -0.5…0.5)
    let vx = 0,
      vy = 0; // velocity
    let tx = 0,
      ty = 0; // target

    function onMouse(e) {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    }

    function onTouch(e) {
      if (e.touches.length > 0) {
        tx = e.touches[0].clientX / window.innerWidth - 0.5;
        ty = e.touches[0].clientY / window.innerHeight - 0.5;
      }
    }

    function onGyro(e) {
      tx = Math.max(-0.5, Math.min(0.5, (e.gamma || 0) / 45));
      ty = Math.max(-0.5, Math.min(0.5, ((e.beta || 0) - 45) / 45));
    }

    function frame() {
      // stiffness 0.05 — pull toward target; damping 0.82 — velocity decay
      vx = (vx + (tx - cx) * 0.05) * 0.82;
      vy = (vy + (ty - cy) * 0.05) * 0.82;
      cx += vx;
      cy += vy;

      const el = containerRef.current;
      if (el) {
        // 50 px horizontal range, 30 px vertical — enough to feel spatial
        el.style.setProperty("--plx", `${(cx * 50).toFixed(2)}px`);
        el.style.setProperty("--ply", `${(cy * 30).toFixed(2)}px`);
      }
      rafId = requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("deviceorientation", onGyro, { passive: true });
    rafId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("deviceorientation", onGyro);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const filter = treatment
    ? `hue-rotate(${treatment.hueRotate}deg) saturate(${treatment.saturate}) brightness(${treatment.brightness}) contrast(${treatment.contrast})`
    : undefined;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ background: SCENES[scene].sky[0][1] }}
    >
      {showVector ? (
        // Photo failed — vector scene is the graceful fallback (with parallax).
        <div className="absolute inset-0" style={{ filter }}>
          <VectorScene p={SCENES[scene]} name={scene} />
        </div>
      ) : (
        // Normal path: sky colour shows while the photo loads, then fades in.
        // scale(1.06) gives 3% edge room so the displaced edges never show.
        <img
          src={src}
          alt=""
          fetchPriority="high"
          onLoad={() => {
            loadedSrcs.add(src);
            setPhotoReady(true);
          }}
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: "center",
            filter,
            opacity: photoReady ? 1 : 0,
            transition: photoReady ? "opacity 0.4s ease" : "none",
            transform:
              "translate(calc(var(--plx, 0px) * -0.8), calc(var(--ply, 0px) * -0.5)) scale(1.06)",
          }}
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

export default memo(SpecialField);
