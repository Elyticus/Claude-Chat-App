import { useEffect, useRef } from "react";

// ─── Special (aurora) mode background ───────────────────────────────────────
//
// Keeps the old Time-of-Day idea — the scene reacts to the real clock — but
// with all-new visuals: flowing aurora curtains (additive-blended sine bands)
// and rising light motes, instead of the stars/clouds/birds the other themes
// use. Same performance rules as star-field.jsx: gradients are pre-baked on
// resize / period change, glow uses shadowBlur (GPU), zero CSS blur layers.

function getPeriod(h) {
  if (h >= 5 && h < 9) return "dawn";
  if (h >= 9 && h < 18) return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

// Sky stays dark in every period (the UI inherits the dark palette); the
// period swaps the aurora hues, the horizon glow and the mote color.
const PALETTES = {
  dawn: {
    sky: [
      [0, "#04111f"],
      [0.55, "#0a2236"],
      [1, "#16344a"],
    ],
    ribbons: ["56,189,248", "45,212,191", "251,191,36"],
    horizon: "251,191,36",
    mote: "165,243,252",
  },
  day: {
    sky: [
      [0, "#03131f"],
      [0.55, "#07283a"],
      [1, "#0c3e4e"],
    ],
    ribbons: ["34,211,238", "52,211,153", "129,140,248"],
    horizon: "34,211,238",
    mote: "186,230,253",
  },
  dusk: {
    sky: [
      [0, "#120724"],
      [0.55, "#2a0f3d"],
      [1, "#46183f"],
    ],
    ribbons: ["244,114,182", "192,132,252", "251,146,60"],
    horizon: "251,146,60",
    mote: "253,186,216",
  },
  night: {
    sky: [
      [0, "#020610"],
      [0.55, "#04101e"],
      [1, "#09202b"],
    ],
    ribbons: ["52,211,153", "45,212,191", "167,139,250"],
    horizon: "52,211,153",
    mote: "167,243,208",
  },
};

// Curtain definitions in viewport fractions; phases offset so bands never sync.
const RIBBON_DEFS = [
  { y: 0.28, amp: 0.075, thick: 0.17, wl: 0.0046, speed: 0.21, phase: 0.0 },
  { y: 0.43, amp: 0.06, thick: 0.14, wl: 0.0034, speed: -0.15, phase: 2.1 },
  { y: 0.58, amp: 0.05, thick: 0.1, wl: 0.0058, speed: 0.11, phase: 4.4 },
];

const NUM_MOTES = 36;

function makeMotes(w, h) {
  return Array.from({ length: NUM_MOTES }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: i < 8 ? Math.random() * 1.6 + 1.6 : Math.random() * 1.1 + 0.5,
    rise: Math.random() * 14 + 6,
    sway: Math.random() * 22 + 8,
    swaySpeed: Math.random() * 0.5 + 0.15,
    phase: Math.random() * Math.PI * 2,
    alpha: Math.random() * 0.4 + 0.3,
    twinkle: Math.random() * 1.4 + 0.5,
  }));
}

export default function AuroraField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let raf = null;
    let last = null;
    let periodTimer = 0;
    let period = getPeriod(new Date().getHours());
    let skyGrad = null;
    let horizonGrad = null;
    let ribbonGrads = [];
    let motes = [];

    // Pre-bake every gradient for the current size + period. The curtain
    // gradients span each band's full travel range, so per-frame drawing
    // allocates nothing but path commands.
    function bake() {
      const w = canvas.width;
      const h = canvas.height;
      const p = PALETTES[period];

      skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      p.sky.forEach(([stop, color]) => skyGrad.addColorStop(stop, color));

      horizonGrad = ctx.createRadialGradient(
        w * 0.5,
        h * 1.05,
        0,
        w * 0.5,
        h * 1.05,
        Math.max(w * 0.55, h * 0.5),
      );
      horizonGrad.addColorStop(0, `rgba(${p.horizon},0.26)`);
      horizonGrad.addColorStop(0.5, `rgba(${p.horizon},0.08)`);
      horizonGrad.addColorStop(1, `rgba(${p.horizon},0)`);

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
    }

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      motes = makeMotes(canvas.width, canvas.height);
      bake();
    }

    // One aurora curtain: top edge is a double sine, bottom edge follows it
    // at a breathing thickness, filled with the band's pre-baked gradient.
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

    function draw(timestamp) {
      if (!last) last = timestamp;
      const dt = Math.min(timestamp - last, 50);
      last = timestamp;
      const t = timestamp / 1000;
      const w = canvas.width;
      const h = canvas.height;

      // Re-check the clock every 30s; re-bake palettes when the period flips.
      periodTimer += dt;
      if (periodTimer > 30000) {
        periodTimer = 0;
        const next = getPeriod(new Date().getHours());
        if (next !== period) {
          period = next;
          bake();
        }
      }

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      RIBBON_DEFS.forEach((r, i) => drawRibbon(r, i, t, w, h));

      // Rising light motes — drift upward with a sway, wrap at the top.
      const moteColor = PALETTES[period].mote;
      motes.forEach((m) => {
        m.y -= (m.rise * dt) / 1000;
        if (m.y < -12) {
          m.y = h + 12;
          m.x = Math.random() * w;
        }
        const x = m.x + Math.sin(t * m.swaySpeed + m.phase) * m.sway;
        const alpha =
          m.alpha * (0.6 + 0.4 * Math.sin(t * m.twinkle + m.phase));

        if (m.r > 1.5) {
          ctx.save();
          ctx.shadowBlur = m.r * 10;
          ctx.shadowColor = `rgba(${moteColor},${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${moteColor},${alpha})`;
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${moteColor},${alpha})`;
          ctx.fill();
        }
      });

      ctx.restore();
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
