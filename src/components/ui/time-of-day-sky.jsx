import { useEffect, useRef } from "react";

// ─── Time period ──────────────────────────────────────────────────────────────

function getTimePeriod(h) {
  if (h >= 5 && h < 9)  return "sunrise";
  if (h >= 9 && h < 18) return "day";
  if (h >= 18 && h < 21) return "sunset";
  return "night";
}

// ─── Stars (night) ────────────────────────────────────────────────────────────

function makeStars(w, h) {
  return Array.from({ length: 300 }, (_, i) => ({
    x: Math.random() * w,
    y: i < 240 ? Math.random() * h * 0.78 : Math.random() * h,
    size: i < 14 ? Math.random() * 2.0 + 1.3 : Math.random() * 0.95 + 0.2,
    baseOpacity: i < 14 ? Math.random() * 0.35 + 0.65 : Math.random() * 0.45 + 0.28,
    twinkleSpeed: Math.random() * 0.8 + 0.22,
    twinkleOffset: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.28 ? "210, 220, 255" : "255, 255, 255",
  }));
}

function spawnShootingStar(w, h) {
  const angle = (Math.random() * 25 + 15) * (Math.PI / 180);
  const speed = Math.random() * 280 + 180;
  let x, y;
  if (Math.random() > 0.4) { x = Math.random() * w * 0.6 + w * 0.3; y = -10; }
  else { x = w + 10; y = Math.random() * h * 0.45; }
  const tailLength = Math.random() * 160 + 80;
  const travelDist = Math.sqrt(w * w + h * h) * (Math.random() * 0.2 + 0.35);
  return {
    x, y,
    vx: -Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed,
    speed,
    tailLength,
    headSize: Math.random() * 1.2 + 0.8,
    lifeTime: (travelDist / speed) * 1000,
    age: 0,
  };
}

// ─── Clouds + birds (sunrise / day / sunset) ──────────────────────────────────

function makeClouds(w, h) {
  return Array.from({ length: 8 }, () => ({
    x:       Math.random() * w * 1.4 - w * 0.2,
    y:       Math.random() * h * 0.5 + h * 0.04,
    scale:   Math.random() * 0.7 + 0.32,
    speed:   Math.random() * 13 + 6,
    opacity: Math.random() * 0.28 + 0.6,
  }));
}

function makeBirds(w, h) {
  return Array.from({ length: 7 }, () => ({
    wx:        (Math.random() - 0.5) * w * 1.6,
    wy:        -(Math.random() * h * 0.45 + h * 0.28),
    vz:        -(Math.random() * 0.07 + 0.04),
    baseSize:  Math.random() * 7 + 7,
    phase:     Math.random() * Math.PI * 2,
    wingSpeed: Math.random() * 1.6 + 2.2,
    z:         Math.random(),
  }));
}

function drawCloud(ctx, x, y, scale, opacity, cloudColor) {
  const r = 72 * scale;
  const circles = [
    [x,            y,            r       ],
    [x + r * 0.88, y - r * 0.28, r * 0.76],
    [x - r * 0.78, y - r * 0.22, r * 0.66],
    [x + r * 1.55, y + r * 0.05, r * 0.68],
    [x - r * 1.45, y + r * 0.08, r * 0.56],
  ];
  ctx.save();
  ctx.fillStyle = `rgba(180,200,230,${opacity * 0.38})`;
  ctx.beginPath();
  circles.forEach(([cx, cy, cr]) => {
    ctx.moveTo(cx + cr * 0.04 + cr * 0.94, cy + cr * 0.14);
    ctx.arc(cx + cr * 0.04, cy + cr * 0.14, cr * 0.94, 0, Math.PI * 2);
  });
  ctx.fill();
  ctx.fillStyle = cloudColor;
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

function advanceBirds(birdsRef, dt, w, h) {
  birdsRef.current.forEach((bird) => {
    bird.phase += bird.wingSpeed * dt / 1000;
    bird.z     += bird.vz * dt / 1000;
    if (bird.z <= 0) {
      bird.z  = 1.0;
      bird.wx = (Math.random() - 0.5) * w * 1.6;
      bird.wy = -(Math.random() * h * 0.45 + h * 0.28);
    }
  });
}

function renderBirds(ctx, birdsRef, w, h, strokeColor) {
  const vpX = w * 0.5, vpY = h * 0.76;
  [...birdsRef.current].sort((a, b) => a.z - b.z).forEach((bird) => {
    const screenX = vpX + bird.wx * bird.z;
    const screenY = vpY + bird.wy * bird.z;
    const size    = bird.baseSize * bird.z;
    const opacity = bird.z * 0.82;
    ctx.save();
    ctx.strokeStyle = strokeColor(opacity);
    ctx.lineWidth   = size * 0.21;
    ctx.lineCap     = "round";
    drawBird(ctx, screenX, screenY, size, bird.phase);
    ctx.restore();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimeOfDaySky() {
  const canvasRef        = useRef(null);
  const starsRef         = useRef([]);
  const shootingStarsRef = useRef([]);
  const cloudsRef        = useRef([]);
  const birdsRef         = useRef([]);
  const rafRef           = useRef(null);
  const lastTimeRef      = useRef(null);
  const nextShootingRef  = useRef(3000);
  const bakedRef         = useRef(null); // pre-baked gradients

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const w = canvas.width, h = canvas.height;

      starsRef.current  = makeStars(w, h);
      cloudsRef.current = makeClouds(w, h);
      birdsRef.current  = makeBirds(w, h);

      // ── Night: moon glow (pre-baked so no per-frame gradient allocation) ──
      const moonX = w * 0.78, moonY = h * 0.18;
      const moonR = Math.min(w, h) * 0.065;

      const moonAtmo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 5.5);
      moonAtmo.addColorStop(0,   "rgba(220, 210, 255, 0.22)");
      moonAtmo.addColorStop(0.38,"rgba(180, 170, 255, 0.10)");
      moonAtmo.addColorStop(1,   "rgba(100, 80,  200, 0)");

      const moonHalo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.4);
      moonHalo.addColorStop(0,   "rgba(255, 250, 220, 0.55)");
      moonHalo.addColorStop(0.5, "rgba(220, 210, 180, 0.25)");
      moonHalo.addColorStop(1,   "rgba(180, 170, 140, 0)");

      const moonBody = ctx.createRadialGradient(
        moonX - moonR * 0.22, moonY - moonR * 0.22, 0,
        moonX, moonY, moonR
      );
      moonBody.addColorStop(0,   "rgba(255, 252, 240, 1)");
      moonBody.addColorStop(0.6, "rgba(240, 235, 210, 0.97)");
      moonBody.addColorStop(1,   "rgba(210, 205, 180, 0.92)");

      // ── Night: deep space atmospheric accents ──
      const nightAcc1 = ctx.createRadialGradient(w * 0.28, h * 0.32, 0, w * 0.28, h * 0.32, w * 0.42);
      nightAcc1.addColorStop(0, "rgba(80, 40, 180, 0.14)");
      nightAcc1.addColorStop(1, "rgba(80, 40, 180, 0)");

      const nightAcc2 = ctx.createRadialGradient(w * 0.72, h * 0.65, 0, w * 0.72, h * 0.65, w * 0.38);
      nightAcc2.addColorStop(0, "rgba(30, 15, 80, 0.12)");
      nightAcc2.addColorStop(1, "rgba(30, 15, 80, 0)");

      bakedRef.current = { moonX, moonY, moonR, moonAtmo, moonHalo, moonBody, nightAcc1, nightAcc2 };
    }

    // ── Night ─────────────────────────────────────────────────────────────────
    function drawNight(timestamp, w, h, dt) {
      const t = timestamp / 1000;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    "#020510");
      bg.addColorStop(0.40, "#080a20");
      bg.addColorStop(0.72, "#0f0a28");
      bg.addColorStop(1,    "#170e34");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      if (bakedRef.current) {
        const { moonX, moonY, moonR, moonAtmo, moonHalo, moonBody, nightAcc1, nightAcc2 } = bakedRef.current;

        // Atmospheric accents
        ctx.fillStyle = nightAcc1;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = nightAcc2;
        ctx.fillRect(0, 0, w, h);

        // Moon atmosphere
        ctx.fillStyle = moonAtmo;
        ctx.fillRect(0, 0, w, h);

        // Moon halo
        ctx.fillStyle = moonHalo;
        ctx.fillRect(0, 0, w, h);

        // Moon body
        ctx.save();
        ctx.shadowBlur  = moonR * 1.4;
        ctx.shadowColor = "rgba(255, 245, 200, 0.55)";
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fillStyle = moonBody;
        ctx.fill();
        ctx.restore();

        // Subtle crater marks
        ctx.save();
        ctx.globalAlpha = 0.07;
        [[0.28, 0.32, 0.12], [-0.22, -0.12, 0.09], [0.08, -0.32, 0.07]].forEach(([dx, dy, cr]) => {
          ctx.beginPath();
          ctx.arc(moonX + moonR * dx, moonY + moonR * dy, moonR * cr, 0, Math.PI * 2);
          ctx.fillStyle = "#8080a8";
          ctx.fill();
        });
        ctx.restore();
      }

      // Stars
      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinkleOffset) * 0.35 + 0.65;
        const alpha   = star.baseOpacity * twinkle;
        if (star.size > 1.4) {
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

      // Shooting stars
      nextShootingRef.current -= dt;
      if (nextShootingRef.current <= 0) {
        shootingStarsRef.current.push(spawnShootingStar(w, h));
        nextShootingRef.current = Math.random() * 5500 + 3200;
      }
      shootingStarsRef.current = shootingStarsRef.current.filter((c) => {
        c.age += dt;
        const progress = c.age / c.lifeTime;
        if (progress >= 1) return false;
        let alpha = progress < 0.12 ? progress / 0.12 : progress > 0.55 ? (1 - progress) / 0.45 : 1;
        alpha *= 0.88;
        c.x += c.vx * dt / 1000;
        c.y += c.vy * dt / 1000;
        const nx = -c.vx / c.speed, ny = -c.vy / c.speed;
        const tailX = c.x + nx * c.tailLength, tailY = c.y + ny * c.tailLength;
        const tg = ctx.createLinearGradient(tailX, tailY, c.x, c.y);
        tg.addColorStop(0,   "rgba(180,210,255,0)");
        tg.addColorStop(0.5, `rgba(210,230,255,${alpha * 0.28})`);
        tg.addColorStop(1,   `rgba(255,255,255,${alpha * 0.85})`);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(c.x, c.y);
        ctx.strokeStyle = tg;
        ctx.lineWidth   = c.headSize * 2;
        ctx.lineCap     = "round";
        ctx.stroke();
        const glowR = c.headSize * 7;
        const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
        hg.addColorStop(0,    `rgba(255,255,255,${alpha})`);
        hg.addColorStop(0.25, `rgba(210,230,255,${alpha * 0.7})`);
        hg.addColorStop(1,    "rgba(130,180,255,0)");
        ctx.beginPath();
        ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = hg;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.headSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
        return true;
      });
    }

    // ── Sunrise / blue hour ───────────────────────────────────────────────────
    function drawSunrise(timestamp, w, h, dt) {
      // Deep navy-blue at top → purple-pink → warm peach → gold horizon
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    "#0d1b3e");
      bg.addColorStop(0.18, "#1e3a5f");
      bg.addColorStop(0.40, "#4a6fa5");
      bg.addColorStop(0.60, "#c4708c");
      bg.addColorStop(0.78, "#e8956d");
      bg.addColorStop(1,    "#ffd09b");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Rising sun glow from below horizon
      const sunX = w * 0.5, sunY = h * 1.06;
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.56);
      sg.addColorStop(0,    "rgba(255, 230, 100, 0.88)");
      sg.addColorStop(0.14, "rgba(255, 160,  50, 0.55)");
      sg.addColorStop(0.32, "rgba(255, 100,  40, 0.24)");
      sg.addColorStop(0.56, "rgba(200,  80,  80, 0.09)");
      sg.addColorStop(1,    "rgba(100,  50, 120, 0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // Pink-tinted clouds
      cloudsRef.current.forEach((cloud) => {
        cloud.x += cloud.speed * dt / 1000;
        if (cloud.x - 215 * cloud.scale > w) {
          cloud.x = -245 * cloud.scale;
          cloud.y = Math.random() * h * 0.52 + h * 0.03;
        }
        drawCloud(ctx, cloud.x, cloud.y, cloud.scale, cloud.opacity,
          `rgba(255,215,200,${cloud.opacity * 0.88})`);
      });

      advanceBirds(birdsRef, dt, w, h);
      renderBirds(ctx, birdsRef, w, h, (a) => `rgba(60,30,60,${a * 0.85})`);
    }

    // ── Day ───────────────────────────────────────────────────────────────────
    function drawDay(timestamp, w, h, dt) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    "#1e88e5");
      bg.addColorStop(0.28, "#42a5f5");
      bg.addColorStop(0.62, "#87ceeb");
      bg.addColorStop(1,    "#b8dff5");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Sun (upper-right)
      const sunX = w * 0.82, sunY = h * 0.1;
      const sunR = Math.min(w, h) * 0.048;
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 6.5);
      sg.addColorStop(0,   "rgba(255,252,200,0.65)");
      sg.addColorStop(0.2, "rgba(255,230,100,0.28)");
      sg.addColorStop(0.5, "rgba(255,200, 50,0.10)");
      sg.addColorStop(1,   "rgba(255,180,  0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.shadowBlur  = sunR * 3.5;
      ctx.shadowColor = "rgba(255,240,100,0.7)";
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,252,220,0.96)";
      ctx.fill();
      ctx.restore();

      // White clouds
      cloudsRef.current.forEach((cloud) => {
        cloud.x += cloud.speed * dt / 1000;
        if (cloud.x - 215 * cloud.scale > w) {
          cloud.x = -245 * cloud.scale;
          cloud.y = Math.random() * h * 0.52 + h * 0.03;
        }
        drawCloud(ctx, cloud.x, cloud.y, cloud.scale, cloud.opacity,
          `rgba(255,255,255,${cloud.opacity})`);
      });

      advanceBirds(birdsRef, dt, w, h);
      renderBirds(ctx, birdsRef, w, h, (a) => `rgba(45,36,28,${a * 0.82})`);
    }

    // ── Sunset / golden hour ──────────────────────────────────────────────────
    function drawSunset(timestamp, w, h, dt) {
      // Deep indigo at top → rich purple → amber → blazing gold horizon
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    "#1a1035");
      bg.addColorStop(0.20, "#2d1b69");
      bg.addColorStop(0.44, "#8b3a1a");
      bg.addColorStop(0.64, "#d4551e");
      bg.addColorStop(0.82, "#f7971e");
      bg.addColorStop(1,    "#ffd200");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Large setting sun near horizon with wide golden atmosphere
      const sunX = w * 0.62, sunY = h * 0.88;
      const sunR = Math.min(w, h) * 0.064;

      const atmo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.68);
      atmo.addColorStop(0,    "rgba(255,210, 80,0.85)");
      atmo.addColorStop(0.12, "rgba(255,150, 40,0.55)");
      atmo.addColorStop(0.28, "rgba(230, 80, 20,0.28)");
      atmo.addColorStop(0.48, "rgba(180, 40, 60,0.12)");
      atmo.addColorStop(0.72, "rgba(120, 20, 80,0.05)");
      atmo.addColorStop(1,    "rgba( 60, 10, 60,0)");
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, w, h);

      // Sun disc
      ctx.save();
      ctx.shadowBlur  = sunR * 2;
      ctx.shadowColor = "rgba(255,200,50,0.8)";
      const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
      disc.addColorStop(0,   "rgba(255,252,220,1)");
      disc.addColorStop(0.4, "rgba(255,200, 80,0.98)");
      disc.addColorStop(1,   "rgba(255,140, 30,0.9)");
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.restore();

      // Golden-tinted clouds
      cloudsRef.current.forEach((cloud) => {
        cloud.x += cloud.speed * dt / 1000;
        if (cloud.x - 215 * cloud.scale > w) {
          cloud.x = -245 * cloud.scale;
          cloud.y = Math.random() * h * 0.52 + h * 0.03;
        }
        drawCloud(ctx, cloud.x, cloud.y, cloud.scale, cloud.opacity,
          `rgba(255,185,80,${cloud.opacity * 0.85})`);
      });

      // Dark silhouetted birds against golden sky
      advanceBirds(birdsRef, dt, w, h);
      renderBirds(ctx, birdsRef, w, h, (a) => `rgba(25,10,5,${a * 0.92})`);
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    function draw(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const { width: w, height: h } = canvas;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      const period = getTimePeriod(new Date().getHours());
      if      (period === "night")   drawNight(timestamp, w, h, dt);
      else if (period === "sunrise") drawSunrise(timestamp, w, h, dt);
      else if (period === "day")     drawDay(timestamp, w, h, dt);
      else                           drawSunset(timestamp, w, h, dt);

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
