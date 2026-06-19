import { useEffect, useRef } from "react";
import { getScene, SCENES } from "@/lib/special-scenes.js";

// ─── Special mode background — three time-of-day scenes ──────────────────────
//
// Picks ONE scene from the real clock (see getScene): blue hour at dawn, golden
// hour in the late afternoon, aurora from twilight into night. Each is a fully
// distinct scene, not a recolor:
//   • blue   — fading stars, drifting horizon haze, a cool brightening glow
//   • golden — a low sun, fanning god rays and floating warm dust
//   • aurora — the original additive-blended sine curtains + rising motes
//
// Same performance rules as star-field.jsx: every gradient is pre-baked on
// resize / scene change, glow uses canvas radial gradients + shadowBlur (GPU),
// there are zero CSS blur layers, and the per-frame loop allocates nothing but
// path commands. Palettes live in @/lib/special-scenes.js.

const TAU = Math.PI * 2;

// Aurora curtains in viewport fractions; phases offset so bands never sync.
const RIBBON_DEFS = [
  { y: 0.28, amp: 0.075, thick: 0.17, wl: 0.0046, speed: 0.21, phase: 0.0 },
  { y: 0.43, amp: 0.06, thick: 0.14, wl: 0.0034, speed: -0.15, phase: 2.1 },
  { y: 0.58, amp: 0.05, thick: 0.1, wl: 0.0058, speed: 0.11, phase: 4.4 },
];

const NUM_MOTES = 36; // rising light — aurora + blue hour
const NUM_STARS = 70; // fading dawn stars — blue hour
const NUM_DUST = 46; // drifting warm dust — golden hour
const NUM_RAYS = 9; // god rays fanning from the sun — golden hour

function makeMotes(w, h) {
  return Array.from({ length: NUM_MOTES }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: i < 8 ? Math.random() * 1.6 + 1.6 : Math.random() * 1.1 + 0.5,
    rise: Math.random() * 14 + 6,
    sway: Math.random() * 22 + 8,
    swaySpeed: Math.random() * 0.5 + 0.15,
    phase: Math.random() * TAU,
    alpha: Math.random() * 0.4 + 0.3,
    twinkle: Math.random() * 1.4 + 0.5,
  }));
}

function makeStars(w, h) {
  // Stars cling to the upper sky and thin out toward the brightening horizon.
  return Array.from({ length: NUM_STARS }, () => ({
    x: Math.random() * w,
    y: Math.random() * h * 0.62,
    r: Math.random() * 1.1 + 0.3,
    base: Math.random() * 0.5 + 0.18,
    tw: Math.random() * 1.6 + 0.4,
    phase: Math.random() * TAU,
  }));
}

function makeDust(w, h) {
  return Array.from({ length: NUM_DUST }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: i < 12 ? Math.random() * 1.8 + 1.3 : Math.random() * 1.0 + 0.4,
    drift: Math.random() * 11 + 5, // horizontal px/s — dust rides the warm air
    bob: Math.random() * 16 + 6,
    bobSpeed: Math.random() * 0.4 + 0.12,
    phase: Math.random() * TAU,
    alpha: Math.random() * 0.4 + 0.25,
    twinkle: Math.random() * 1.2 + 0.4,
  }));
}

function makeMist(h) {
  // A few soft haze bands drifting horizontally near the horizon.
  return [
    { y: h * 0.6, sx: 1.2, sy: 0.42, speed: 5, alpha: 0.28, off: 0.25 },
    { y: h * 0.72, sx: 1.5, sy: 0.5, speed: 9, alpha: 0.42, off: 0.0 },
    { y: h * 0.84, sx: 1.9, sy: 0.46, speed: -6, alpha: 0.34, off: 0.55 },
  ];
}

// Positive modulo so haze bands wrap cleanly regardless of drift direction.
function wrap(v, span) {
  return ((v % span) + span) % span;
}

export default function SpecialField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let raf = null;
    let last = null;
    let sceneTimer = 0;
    let scene = getScene(new Date().getHours());

    // Baked assets (rebuilt on resize / scene change).
    let skyGrad = null;
    let glowGrad = null; // blue + aurora horizon glow
    let sunGrad = null; // golden hour sun glow
    let mistGrad = null; // blue hour haze puff (baked at origin, positioned via transform)
    let mistR = 0;
    let ribbonGrads = [];
    let motes = [];
    let stars = [];
    let dust = [];
    let mist = [];
    let sunX = 0;
    let sunY = 0;
    let sunR = 0;

    function bake() {
      const w = canvas.width;
      const h = canvas.height;
      const p = SCENES[scene];

      skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      p.sky.forEach(([stop, color]) => skyGrad.addColorStop(stop, color));

      if (scene === "aurora") {
        glowGrad = ctx.createRadialGradient(
          w * 0.5,
          h * 1.05,
          0,
          w * 0.5,
          h * 1.05,
          Math.max(w * 0.55, h * 0.5),
        );
        glowGrad.addColorStop(0, `rgba(${p.horizon},0.26)`);
        glowGrad.addColorStop(0.5, `rgba(${p.horizon},0.08)`);
        glowGrad.addColorStop(1, `rgba(${p.horizon},0)`);

        ribbonGrads = RIBBON_DEFS.map((r, i) => {
          const c = p.ribbons[i % p.ribbons.length];
          const baseY = r.y * h;
          const amp = r.amp * h;
          const thick = r.thick * h;
          const g = ctx.createLinearGradient(
            0,
            baseY - amp * 1.5,
            0,
            baseY + thick + amp * 1.5,
          );
          g.addColorStop(0, `rgba(${c},0)`);
          g.addColorStop(0.2, `rgba(${c},0.42)`);
          g.addColorStop(0.55, `rgba(${c},0.12)`);
          g.addColorStop(1, `rgba(${c},0)`);
          return g;
        });
        motes = makeMotes(w, h);
      } else if (scene === "blue") {
        glowGrad = ctx.createRadialGradient(
          w * 0.5,
          h * 1.04,
          0,
          w * 0.5,
          h * 1.04,
          Math.max(w * 0.7, h * 0.62),
        );
        glowGrad.addColorStop(0, `rgba(${p.glow},0.3)`);
        glowGrad.addColorStop(0.5, `rgba(${p.glow},0.08)`);
        glowGrad.addColorStop(1, `rgba(${p.glow},0)`);

        mistR = Math.max(w, h) * 0.42;
        mistGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, mistR);
        mistGrad.addColorStop(0, `rgba(${p.glow},0.5)`);
        mistGrad.addColorStop(0.6, `rgba(${p.glow},0.12)`);
        mistGrad.addColorStop(1, `rgba(${p.glow},0)`);

        stars = makeStars(w, h);
        mist = makeMist(h);
        motes = makeMotes(w, h);
      } else {
        // golden
        sunX = w * 0.5;
        sunY = h * 0.99;
        sunR = Math.min(w, h) * 0.075;
        sunGrad = ctx.createRadialGradient(
          sunX,
          sunY,
          0,
          sunX,
          sunY,
          Math.max(w, h) * 0.72,
        );
        sunGrad.addColorStop(0, `rgba(${p.glow},0.5)`);
        sunGrad.addColorStop(0.32, `rgba(${p.glow},0.16)`);
        sunGrad.addColorStop(1, `rgba(${p.glow},0)`);
        dust = makeDust(w, h);
      }
    }

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      bake();
    }

    // One aurora curtain: top edge is a double sine, bottom edge follows it at a
    // breathing thickness, filled with the band's pre-baked gradient.
    function drawRibbon(r, idx, t, w, h) {
      const baseY = r.y * h;
      const amp = r.amp * h;
      const thick = r.thick * h;
      const step = 18;

      ctx.beginPath();
      ctx.moveTo(
        -24,
        baseY +
          Math.sin(-24 * r.wl + t * r.speed + r.phase) * amp +
          Math.sin(-24 * r.wl * 2.7 - t * r.speed * 1.7) * amp * 0.35,
      );
      for (let x = -24 + step; x <= w + 24; x += step) {
        ctx.lineTo(
          x,
          baseY +
            Math.sin(x * r.wl + t * r.speed + r.phase) * amp +
            Math.sin(x * r.wl * 2.7 - t * r.speed * 1.7) * amp * 0.35,
        );
      }
      for (let x = w + 24; x >= -24; x -= step) {
        ctx.lineTo(
          x,
          baseY +
            Math.sin(x * r.wl + t * r.speed + r.phase) * amp +
            Math.sin(x * r.wl * 2.7 - t * r.speed * 1.7) * amp * 0.35 +
            thick * (0.75 + 0.25 * Math.sin(x * r.wl * 1.4 + t * 0.3 + r.phase)),
        );
      }
      ctx.closePath();
      ctx.fillStyle = ribbonGrads[idx];
      ctx.fill();
    }

    // Shared glowing-particle blob (used by rising motes and warm dust).
    function drawBlob(x, y, r, color, alpha) {
      if (r > 1.4) {
        ctx.save();
        ctx.shadowBlur = r * 10;
        ctx.shadowColor = `rgba(${color},${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.fill();
      }
    }

    function drawRisingMotes(color, t, dt, w, h) {
      motes.forEach((m) => {
        m.y -= (m.rise * dt) / 1000;
        if (m.y < -12) {
          m.y = h + 12;
          m.x = Math.random() * w;
        }
        const x = m.x + Math.sin(t * m.swaySpeed + m.phase) * m.sway;
        const alpha = m.alpha * (0.6 + 0.4 * Math.sin(t * m.twinkle + m.phase));
        drawBlob(x, m.y, m.r, color, alpha);
      });
    }

    function drawAurora(t, dt, w, h) {
      RIBBON_DEFS.forEach((r, i) => drawRibbon(r, i, t, w, h));
      drawRisingMotes(SCENES.aurora.mote, t, dt, w, h);
    }

    function drawBlue(t, dt, w, h) {
      const p = SCENES.blue;
      // Fading dawn stars.
      stars.forEach((s) => {
        const a = s.base * (0.45 + 0.55 * Math.sin(t * s.tw + s.phase));
        if (a <= 0.01) return;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fillStyle = `rgba(${p.mote},${a})`;
        ctx.fill();
      });
      // Drifting horizon haze.
      const span = canvas.width + 2 * mistR;
      mist.forEach((m) => {
        const cx = wrap(m.off * canvas.width + t * m.speed + mistR, span) - mistR;
        ctx.save();
        ctx.globalAlpha = m.alpha;
        ctx.translate(cx, m.y);
        ctx.scale(m.sx, m.sy);
        ctx.fillStyle = mistGrad;
        ctx.fillRect(-mistR, -mistR, mistR * 2, mistR * 2);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      // Cool rising motes.
      drawRisingMotes(p.mote, t, dt, w, h);
    }

    function drawGolden(t, dt, w, h) {
      const p = SCENES.golden;
      // Sun glow wash.
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
      // God rays fanning up from the low sun — overlapping near the apex makes
      // the sun read brightest, thinning out as single beams toward the sky.
      const L = Math.hypot(w, h);
      ctx.save();
      ctx.translate(sunX, sunY);
      for (let i = 0; i < NUM_RAYS; i++) {
        const a = -Math.PI * 0.92 + (i / (NUM_RAYS - 1)) * (Math.PI * 0.84);
        const ang = a + Math.sin(t * 0.22 + i * 1.7) * 0.03;
        const dw = 0.022;
        const alpha = Math.max(0, 0.05 + 0.045 * Math.sin(t * 0.6 + i * 1.3));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang - dw) * L, Math.sin(ang - dw) * L);
        ctx.lineTo(Math.cos(ang + dw) * L, Math.sin(ang + dw) * L);
        ctx.closePath();
        ctx.fillStyle = `rgba(${p.glow},${alpha})`;
        ctx.fill();
      }
      ctx.restore();
      // Sun disc.
      ctx.save();
      ctx.shadowBlur = sunR * 1.6;
      ctx.shadowColor = `rgba(${p.glow},0.8)`;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, TAU);
      ctx.fillStyle = `rgba(${p.glow},0.85)`;
      ctx.fill();
      ctx.restore();
      // Floating warm dust.
      dust.forEach((d) => {
        d.x += (d.drift * dt) / 1000;
        if (d.x > w + 12) d.x = -12;
        const y = d.y + Math.sin(t * d.bobSpeed + d.phase) * d.bob;
        const alpha = d.alpha * (0.55 + 0.45 * Math.sin(t * d.twinkle + d.phase));
        drawBlob(d.x, y, d.r, p.mote, alpha);
      });
    }

    function draw(timestamp) {
      if (!last) last = timestamp;
      const dt = Math.min(timestamp - last, 50);
      last = timestamp;
      const t = timestamp / 1000;
      const w = canvas.width;
      const h = canvas.height;

      // Re-check the clock every 30s; re-bake when the scene flips.
      sceneTimer += dt;
      if (sceneTimer > 30000) {
        sceneTimer = 0;
        const next = getScene(new Date().getHours());
        if (next !== scene) {
          scene = next;
          bake();
        }
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Everything luminous composites additively over the sky.
      ctx.globalCompositeOperation = "lighter";
      if (scene !== "golden" && glowGrad) {
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);
      }

      if (scene === "aurora") drawAurora(t, dt, w, h);
      else if (scene === "blue") drawBlue(t, dt, w, h);
      else drawGolden(t, dt, w, h);

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
