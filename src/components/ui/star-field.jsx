import { useEffect, useRef } from "react";

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
  // Angle: 15–40° below horizontal — classic diagonal streak
  const angle = (Math.random() * 25 + 15) * (Math.PI / 180);
  const speed = Math.random() * 260 + 180; // px/s

  // Spawn from top-right area or right edge
  let x, y;
  if (Math.random() > 0.4) {
    x = Math.random() * w * 0.6 + w * 0.3;
    y = -10;
  } else {
    x = w + 10;
    y = Math.random() * h * 0.45;
  }

  const tailLength = Math.random() * 140 + 90;
  // travel only 35–55% of the diagonal so the comet fades mid-screen
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

export default function StarField({ isDark = true }) {
  const canvasRef      = useRef(null);
  const starsRef       = useRef([]);
  const cometsRef      = useRef([]);
  const rafRef         = useRef(null);
  const lastTimeRef    = useRef(null);
  const nextCometRef   = useRef(2500); // first comet after 2.5 s

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      starsRef.current = makeStars(canvas.width, canvas.height);
    }

    function draw(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const t = timestamp / 1000;
      const { width: w, height: h } = canvas;

      ctx.clearRect(0, 0, w, h);

      // ── Stars ──────────────────────────────────────────────────────────────
      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinkleOffset) * 0.35 + 0.65;
        const alpha   = star.baseOpacity * twinkle * (isDark ? 1 : 0.4);

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

      // ── Spawn comets ───────────────────────────────────────────────────────
      nextCometRef.current -= dt;
      if (nextCometRef.current <= 0) {
        cometsRef.current.push(spawnComet(w, h));
        nextCometRef.current = Math.random() * 5000 + 3500; // next in 3.5–8.5 s
      }

      // ── Draw + update comets ───────────────────────────────────────────────
      cometsRef.current = cometsRef.current.filter((c) => {
        c.age += dt;
        const progress = c.age / c.lifeTime;
        if (progress >= 1) return false;

        // Fade in over first 12%, then fade out from 55% onward
        let alpha;
        if      (progress < 0.12) alpha = progress / 0.12;
        else if (progress > 0.55) alpha = (1 - progress) / 0.45;
        else                       alpha = 1;
        alpha *= 0.95;

        // Advance position
        c.x += c.vx * dt / 1000;
        c.y += c.vy * dt / 1000;

        // Unit vector pointing along the tail (opposite of velocity)
        const nx = -c.vx / c.speed;
        const ny = -c.vy / c.speed;
        const tailX = c.x + nx * c.tailLength;
        const tailY = c.y + ny * c.tailLength;

        // Tail — gradient from transparent at tip to bright at head
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

        // Head glow
        const glowR    = c.headSize * 7;
        const headGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
        headGlow.addColorStop(0,    `rgba(255, 255, 255, ${alpha})`);
        headGlow.addColorStop(0.25, `rgba(210, 230, 255, ${alpha * 0.7})`);
        headGlow.addColorStop(1,    `rgba(130, 180, 255, 0)`);

        ctx.beginPath();
        ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();

        // Head core dot
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.headSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        return true;
      });

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
