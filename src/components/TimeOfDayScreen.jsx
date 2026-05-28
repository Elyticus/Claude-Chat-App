import { useState, useEffect } from "react";
import { X } from "lucide-react";
import TimeOfDaySky from "./ui/time-of-day-sky.jsx";

function getTimePeriod(h) {
  if (h >= 5 && h < 9)  return { label: "Blue Hour",    sub: "Morning sky awakens" };
  if (h >= 9 && h < 18) return { label: "Daytime",      sub: "Clear skies ahead"   };
  if (h >= 18 && h < 21) return { label: "Golden Hour", sub: "Evening light fades"  };
  return                        { label: "Night Sky",    sub: "Stars and moonlight"  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function TimeOfDayScreen({ onClose }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  const isNight  = h >= 21 || h < 5;
  const isSunset = h >= 18 && h < 21;

  const period = getTimePeriod(h);
  const ampm   = h >= 12 ? "PM" : "AM";
  const h12    = h % 12 || 12;

  const clockColor = isNight
    ? "rgba(230, 225, 255, 0.97)"
    : "rgba(255, 255, 255, 0.97)";

  const clockShadow = isNight
    ? "0 0 48px rgba(160,140,255,0.45), 0 2px 16px rgba(0,0,0,0.85)"
    : isSunset
    ? "0 0 48px rgba(255,180,50,0.4), 0 2px 16px rgba(0,0,0,0.65)"
    : "0 2px 20px rgba(0,0,0,0.48)";

  const labelColor = isNight
    ? "rgba(200, 195, 255, 0.88)"
    : isSunset
    ? "rgba(255, 220, 120, 0.92)"
    : "rgba(255, 255, 255, 0.88)";

  const overlayGradient = isNight
    ? "linear-gradient(to bottom, rgba(2,5,16,0.42) 0%, transparent 38%, rgba(2,5,16,0.55) 100%)"
    : isSunset
    ? "linear-gradient(to bottom, rgba(18,8,36,0.32) 0%, transparent 38%, rgba(18,8,36,0.42) 100%)"
    : "linear-gradient(to bottom, rgba(4,12,38,0.25) 0%, transparent 38%, rgba(4,12,38,0.32) 100%)";

  return (
    <div className="absolute inset-0 animate-scale-in overflow-hidden" style={{ transformOrigin: "center" }}>

      {/* Animated sky canvas */}
      <TimeOfDaySky />

      {/* Legibility overlay — no filter: blur, just rgba gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: overlayGradient }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-5 sm:right-5 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-10"
        style={{
          background: "rgba(0,0,0,0.42)",
          border:     "1px solid rgba(255,255,255,0.18)",
          color:      "rgba(255,255,255,0.9)",
        }}
        aria-label="Close time screen"
      >
        <X size={16} />
      </button>

      {/* Center clock */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none">

        {/* Period badge */}
        <div
          className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.24em] px-3.5 py-1 rounded-full"
          style={{
            background: "rgba(0,0,0,0.28)",
            color:      labelColor,
            border:     "1px solid rgba(255,255,255,0.13)",
          }}
        >
          {period.label}
        </div>

        {/* Hours : Minutes */}
        <div
          className="font-bold tracking-tight leading-none"
          style={{
            fontSize:            "clamp(4rem, 15vw, 9.5rem)",
            color:               clockColor,
            textShadow:          clockShadow,
            fontVariantNumeric:  "tabular-nums",
          }}
        >
          {pad(h12)}
          <span style={{ opacity: 0.55, margin: "0 0.04em" }}>:</span>
          {pad(m)}
          <span
            style={{
              fontSize:       "0.38em",
              verticalAlign:  "super",
              opacity:        0.65,
              marginLeft:     "0.14em",
              letterSpacing:  "0.04em",
            }}
          >
            {ampm}
          </span>
        </div>

        {/* Seconds */}
        <div
          style={{
            fontSize:           "clamp(1.2rem, 3.8vw, 2.2rem)",
            fontVariantNumeric: "tabular-nums",
            color:              "rgba(255,255,255,0.45)",
            fontWeight:         300,
            letterSpacing:      "0.12em",
            textShadow:         "0 1px 8px rgba(0,0,0,0.55)",
          }}
        >
          :{pad(s)}
        </div>

        {/* Date + subtitle */}
        <div
          className="flex flex-col items-center gap-1 mt-2"
          style={{
            color:      "rgba(255,255,255,0.5)",
            textShadow: "0 1px 8px rgba(0,0,0,0.55)",
          }}
        >
          <div className="text-sm font-medium tracking-wide">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month:   "long",
              day:     "numeric",
            })}
          </div>
          <div className="text-[11px] tracking-[0.26em] uppercase opacity-65">
            {period.sub}
          </div>
        </div>

      </div>
    </div>
  );
}
