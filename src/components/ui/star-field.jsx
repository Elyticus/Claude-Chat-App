import { memo, useLayoutEffect, useRef } from "react";

// ── Dark mode ──────────────────────────────────────────────────────────────────

const NUM_STARS = 260;

function makeStars(w, h) {
  return Array.from({ length: NUM_STARS }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: i < 12 ? Math.random() * 1.8 + 1.4 : Math.random() * 1.0 + 0.25,
    baseOpacity: i < 12 ? Math.random() * 0.4 + 0.6 : Math.random() * 0.5 + 0.25,
    twinkleSpeed: Math.random() * 0.8 + 0.3,
    twinkleOffset: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.3 ? "210, 220, 255" : "255, 255, 255",
  }));
}

function spawnComet(w, h) {
  const angle = (Math.random() * 25 + 15) * (Math.PI / 180);
  const speed = Math.random() * 260 + 180;
  let x, y;
  if (Math.random() > 0.4) {
    x = Math.random() * w * 0.6 + w * 0.3;
    y = -10;
  } else {
    x = w + 10;
    y = Math.random() * h * 0.45;
  }
  const tailLength = Math.random() * 140 + 90;
  const travelDist = Math.sqrt(w * w + h * h) * (Math.random() * 0.2 + 0.35);
  const lifeTime = (travelDist / speed) * 1000;
  return {
    x, y,
    vx: -Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed,
    speed,
    tailLength,
    headSize: Math.random() * 1.2 + 0.9,
    lifeTime,
    age: 0,
  };
}

// ── Light mode ─────────────────────────────────────────────────────────────────

const NUM_CLOUDS = 7;
const NUM_BIRDS  = 6;

function makeClouds(w, h) {
  return Array.from({ length: NUM_CLOUDS }, () => ({
    x:       Math.random() * w * 1.4 - w * 0.2,
    y:       Math.random() * h * 0.52 + h * 0.03,
    scale:   Math.random() * 0.7 + 0.3,
    speed:   Math.random() * 14 + 7,
    opacity: Math.random() * 0.3 + 0.62,
  }));
}

function makeBirds(w, h) {
  return Array.from({ length: NUM_BIRDS }, () => ({
    // World-space offset from the vanishing point (screen pos = vp + offset * z)
    wx:        (Math.random() - 0.5) * w * 1.6,
    wy:        -(Math.random() * h * 0.48 + h * 0.26), // always above VP
    vz:        -(Math.random() * 0.07 + 0.04),          // drift into background
    baseSize:  Math.random() * 7 + 7,
    phase:     Math.random() * Math.PI * 2,
    wingSpeed: Math.random() * 1.6 + 2.2,
    z:         Math.random(),
  }));
}

function drawCloud(ctx, x, y, scale, opacity) {
  const r = 72 * scale;
  const circles = [
    [x,            y,            r       ],
    [x + r * 0.88, y - r * 0.28, r * 0.76],
    [x - r * 0.78, y - r * 0.22, r * 0.66],
    [x + r * 1.55, y + r * 0.05, r * 0.68],
    [x - r * 1.45, y + r * 0.08, r * 0.56],
  ];
  ctx.save();

  // Shadow underlay — one unified path so overlaps don't double-darken
  ctx.fillStyle = `rgba(180,200,230,${opacity * 0.38})`;
  ctx.beginPath();
  circles.forEach(([cx, cy, cr]) => {
    // moveTo prevents the implicit lineTo between arcs that causes winding-rule holes
    ctx.moveTo(cx + cr * 0.04 + cr * 0.94, cy + cr * 0.14);
    ctx.arc(cx + cr * 0.04, cy + cr * 0.14, cr * 0.94, 0, Math.PI * 2);
  });
  ctx.fill();

  // White cloud body — single path fill, so the whole shape is one solid piece
  ctx.fillStyle = `rgba(255,255,255,${opacity})`;
  ctx.beginPath();
  circles.forEach(([cx, cy, cr]) => {
    ctx.moveTo(cx + cr, cy);
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  });
  ctx.fill();

  ctx.restore();
}

function drawBird(ctx, x, y, size, phase) {
  const flap = Math.sin(phase);
  const cy = y + (1 - Math.abs(flap)) * size * 0.14;
  ctx.beginPath();
  ctx.moveTo(x - size, y - flap * size * 0.46);
  ctx.quadraticCurveTo(x - size * 0.44, cy, x, y);
  ctx.quadraticCurveTo(x + size * 0.44, cy, x + size, y - flap * size * 0.46);
  ctx.stroke();
}

// ── Component ──────────────────────────────────────────────────────────────────

// Memoized: OrbitalHub re-renders ~20×/sec to spin its bubbles. Without memo
// this canvas component would be re-invoked on every rotation tick. It only
// depends on `isDark`, so skip those re-renders to free the main thread.
function StarField({ isDark = true, paused = false }) {
  const canvasRef    = useRef(null);
  const starsRef     = useRef([]);
  const cometsRef    = useRef([]);
  const cloudsRef    = useRef([]);
  const birdsRef     = useRef([]);
  const rafRef       = useRef(null);
  const lastTimeRef  = useRef(null);
  const nextCometRef = useRef(2500);
  const darkGradsRef = useRef(null);

  // Layout effect (not useEffect) so the canvas is repainted synchronously
  // before the browser paints — and, crucially, before document.startViewTransition
  // captures its post-switch snapshot. Otherwise switching INTO light mode while
  // paused would snapshot the near-white container background showing through the
  // stale (transparent) dark frame. Re-runs on `isDark` so a mode change always
  // repaints, and on `paused` to start/stop the loop.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    function resize() {
      const nextW = canvas.offsetWidth;
      const nextH = canvas.offsetHeight;
      // iOS fires the ResizeObserver when the PWA returns from the background
      // even when nothing actually resized. Re-assigning canvas.width/height
      // clears the canvas to transparent, which shows up as a one-frame flash
      // (the "blink" on resume). Skip when the dimensions are unchanged.
      if (nextW === canvas.width && nextH === canvas.height) return;
      canvas.width  = nextW;
      canvas.height = nextH;
      const w = canvas.width, h = canvas.height;
      starsRef.current  = makeStars(w, h);
      cloudsRef.current = makeClouds(w, h);
      birdsRef.current  = makeBirds(w, h);

      // Pre-bake dark-mode atmospheric gradients once per resize
      const g1 = ctx.createRadialGradient(w * -0.05 + w * 0.34, h * -0.05 + h * 0.34, 0, w * -0.05 + w * 0.34, h * -0.05 + h * 0.34, w * 0.48);
      g1.addColorStop(0,   "rgba(99,102,241,0.22)");
      g1.addColorStop(1,   "rgba(99,102,241,0)");

      const g2 = ctx.createRadialGradient(w * 1.08 - w * 0.32, h * 1.08 - h * 0.32, 0, w * 1.08 - w * 0.32, h * 1.08 - h * 0.32, w * 0.45);
      g2.addColorStop(0,   "rgba(139,92,246,0.18)");
      g2.addColorStop(1,   "rgba(139,92,246,0)");

      const g3 = ctx.createRadialGradient(w * 0.52 + w * 0.27, h * 0.28 + h * 0.27, 0, w * 0.52 + w * 0.27, h * 0.28 + h * 0.27, w * 0.38);
      g3.addColorStop(0,   "rgba(6,182,212,0.12)");
      g3.addColorStop(1,   "rgba(6,182,212,0)");

      const g4 = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, 310);
      g4.addColorStop(0,   "rgba(99,102,241,0.12)");
      g4.addColorStop(1,   "rgba(99,102,241,0)");

      darkGradsRef.current = [g1, g2, g3, g4];
    }

    function renderFrame(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const t = timestamp / 1000;
      const { width: w, height: h } = canvas;

      ctx.clearRect(0, 0, w, h);

      if (isDark) {
        // ── Atmospheric glows (pre-baked gradients, zero per-frame allocation) ──
        if (darkGradsRef.current) {
          darkGradsRef.current.forEach((g) => {
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          });
        }

        // ── Stars ───────────────────────────────────────────────────────────────
        starsRef.current.forEach((star) => {
          const twinkle = Math.sin(t * star.twinkleSpeed + star.twinkleOffset) * 0.35 + 0.65;
          const alpha   = star.baseOpacity * twinkle;

          if (star.size > 1.4) {
            // shadowBlur is GPU-accelerated and allocates nothing on the JS heap,
            // replacing the createRadialGradient + extra arc that ran every frame.
            ctx.save();
            ctx.shadowBlur  = star.size * 14;
            ctx.shadowColor = `rgba(${star.hue}, ${alpha * 0.55})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
            ctx.fill();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
            ctx.fill();
          }
        });

        // ── Spawn comets ─────────────────────────────────────────────────────────
        nextCometRef.current -= dt;
        if (nextCometRef.current <= 0) {
          cometsRef.current.push(spawnComet(w, h));
          nextCometRef.current = Math.random() * 5000 + 3500;
        }

        // ── Draw + update comets ──────────────────────────────────────────────────
        cometsRef.current = cometsRef.current.filter((c) => {
          c.age += dt;
          const progress = c.age / c.lifeTime;
          if (progress >= 1) return false;

          let alpha;
          if      (progress < 0.12) alpha = progress / 0.12;
          else if (progress > 0.55) alpha = (1 - progress) / 0.45;
          else                      alpha = 1;
          alpha *= 0.95;

          c.x += c.vx * dt / 1000;
          c.y += c.vy * dt / 1000;

          const nx = -c.vx / c.speed;
          const ny = -c.vy / c.speed;
          const tailX = c.x + nx * c.tailLength;
          const tailY = c.y + ny * c.tailLength;

          const tailGrad = ctx.createLinearGradient(tailX, tailY, c.x, c.y);
          tailGrad.addColorStop(0,   `rgba(180, 210, 255, 0)`);
          tailGrad.addColorStop(0.5, `rgba(210, 230, 255, ${alpha * 0.3})`);
          tailGrad.addColorStop(1,   `rgba(255, 255, 255, ${alpha * 0.9})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(c.x, c.y);
          ctx.strokeStyle = tailGrad;
          ctx.lineWidth   = c.headSize * 2;
          ctx.lineCap     = "round";
          ctx.stroke();

          const glowR    = c.headSize * 7;
          const headGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
          headGlow.addColorStop(0,    `rgba(255, 255, 255, ${alpha})`);
          headGlow.addColorStop(0.25, `rgba(210, 230, 255, ${alpha * 0.7})`);
          headGlow.addColorStop(1,    `rgba(130, 180, 255, 0)`);

          ctx.beginPath();
          ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = headGlow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(c.x, c.y, c.headSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();

          return true;
        });

      } else {
        // ── Sunrise sky gradient ─────────────────────────────────────────────────
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0,    "#A3C8E8");   // soft morning blue
        sky.addColorStop(0.32, "#C8E5F5");   // pale blue
        sky.addColorStop(0.58, "#FFE0A8");   // warm golden
        sky.addColorStop(0.78, "#FFB060");   // orange band
        sky.addColorStop(1,    "#FF7035");   // deep horizon orange
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Sun glow just below horizon
        const sunX    = w * 0.5;
        const sunY    = h * 1.08;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.52);
        sunGlow.addColorStop(0,    "rgba(255, 245, 120, 0.88)");
        sunGlow.addColorStop(0.18, "rgba(255, 185, 55,  0.48)");
        sunGlow.addColorStop(0.42, "rgba(255, 120, 30,  0.18)");
        sunGlow.addColorStop(1,    "rgba(255, 80,  20,  0)");
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, w, h);

        // ── Clouds ───────────────────────────────────────────────────────────────
        cloudsRef.current.forEach((cloud) => {
          cloud.x += cloud.speed * dt / 1000;
          if (cloud.x - 215 * cloud.scale > w) {
            cloud.x = -245 * cloud.scale;
            cloud.y = Math.random() * h * 0.52 + h * 0.03;
          }
          drawCloud(ctx, cloud.x, cloud.y, cloud.scale, cloud.opacity);
        });

        // ── Birds ────────────────────────────────────────────────────────────────
        const vpX = w * 0.5;
        const vpY = h * 0.78;

        birdsRef.current.forEach((bird) => {
          bird.phase += bird.wingSpeed * dt / 1000;
          bird.z    += bird.vz * dt / 1000;

          // Respawn at full z with a new random world position
          if (bird.z <= 0) {
            bird.z  = 1.0;
            bird.wx = (Math.random() - 0.5) * w * 1.6;
            bird.wy = -(Math.random() * h * 0.48 + h * 0.26);
          }
        });

        // Render far→near so closer birds draw on top
        [...birdsRef.current]
          .sort((a, b) => a.z - b.z)
          .forEach((bird) => {
            const screenX = vpX + bird.wx * bird.z;
            const screenY = vpY + bird.wy * bird.z;
            const size    = bird.baseSize * bird.z;
            const opacity = bird.z * 0.82;
            ctx.save();
            ctx.strokeStyle = `rgba(45, 36, 28, ${opacity})`;
            ctx.lineWidth   = size * 0.21;
            ctx.lineCap     = "round";
            drawBird(ctx, screenX, screenY, size, bird.phase);
            ctx.restore();
          });

      }
    }

    function loop(timestamp) {
      renderFrame(timestamp);
      rafRef.current = requestAnimationFrame(loop);
    }

    // When the PWA is backgrounded, rAF stops and iOS may discard the canvas
    // backing store, leaving it blank on return. Cancel cleanly on hide and, on
    // show, reset dt and repaint on the next frame so the starfield is restored
    // immediately rather than flashing the empty background.
    function handleVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (!rafRef.current && !paused) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    document.addEventListener("visibilitychange", handleVisibility);
    // Always paint one frame of the CURRENT mode immediately. This keeps a
    // paused background correct after a mode switch (otherwise the previous
    // mode's frozen frame — transparent in dark mode — would stay on the canvas
    // and let light mode's near-white background show through). Only schedule
    // the ongoing loop when not paused.
    lastTimeRef.current = null;
    renderFrame(performance.now());
    if (!paused) rafRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
  }, [paused, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

export default memo(StarField);
