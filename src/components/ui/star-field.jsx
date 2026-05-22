import { useEffect, useRef } from "react";

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
  // Vanishing point: warm horizon just above where sun glow peaks
  const vpY = h * 0.78;
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
  const r = 44 * scale;
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.beginPath();
  ctx.arc(x,              y,              r,          0, Math.PI * 2);
  ctx.arc(x + r * 0.88,   y - r * 0.28,   r * 0.76,  0, Math.PI * 2);
  ctx.arc(x - r * 0.78,   y - r * 0.22,   r * 0.66,  0, Math.PI * 2);
  ctx.arc(x + r * 1.55,   y + r * 0.05,   r * 0.68,  0, Math.PI * 2);
  ctx.arc(x - r * 1.45,   y + r * 0.08,   r * 0.56,  0, Math.PI * 2);
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

export default function StarField({ isDark = true }) {
  const canvasRef    = useRef(null);
  const starsRef     = useRef([]);
  const cometsRef    = useRef([]);
  const cloudsRef    = useRef([]);
  const birdsRef     = useRef([]);
  const rafRef       = useRef(null);
  const lastTimeRef  = useRef(null);
  const nextCometRef = useRef(2500);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      starsRef.current  = makeStars(canvas.width, canvas.height);
      cloudsRef.current = makeClouds(canvas.width, canvas.height);
      birdsRef.current  = makeBirds(canvas.width, canvas.height);
    }

    function draw(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const t = timestamp / 1000;
      const { width: w, height: h } = canvas;

      ctx.clearRect(0, 0, w, h);

      if (isDark) {
        // ── Stars ───────────────────────────────────────────────────────────────
        starsRef.current.forEach((star) => {
          const twinkle = Math.sin(t * star.twinkleSpeed + star.twinkleOffset) * 0.35 + 0.65;
          const alpha   = star.baseOpacity * twinkle;

          if (star.size > 1.4) {
            const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 4);
            glow.addColorStop(0, `rgba(${star.hue}, ${alpha * 0.6})`);
            glow.addColorStop(1, `rgba(${star.hue}, 0)`);
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
          ctx.fill();
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
          if (cloud.x - 130 * cloud.scale > w) {
            cloud.x = -150 * cloud.scale;
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

      rafRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
