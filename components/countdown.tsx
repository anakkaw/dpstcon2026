"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  locale: string;
}

export function Countdown({ locale }: CountdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false,
  });

  useEffect(() => {
    // Avoid synchronous setState within effect body by deferring with requestAnimationFrame
    const handle = requestAnimationFrame(() => {
      setIsMounted(true);
    });

    // Target date: 3 June 2026 at 09:00:00 GMT+7 (Bangkok Time)
    const targetTime = new Date("2026-06-03T09:00:00+07:00").getTime();

    const updateTimer = () => {
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isOver: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => {
      cancelAnimationFrame(handle);
      clearInterval(interval);
    };
  }, []);

  const labels = {
    en: {
      days: "Days",
      hours: "Hours",
      minutes: "Minutes",
      seconds: "Seconds",
      status: "Countdown to Opening Ceremony",
      live: "Conference in Session",
    },
    th: {
      days: "วัน",
      hours: "ชั่วโมง",
      minutes: "นาที",
      seconds: "วินาที",
      status: "นับถอยหลังสู่พิธีเปิดงานประชุม",
      live: "กำลังดำเนินงานประชุมวิชาการ",
    },
  };

  const currentLabel = locale === "en" ? labels.en : labels.th;

  // Render a clean placeholder shell to prevent layout shift during hydration
  const renderDigits = (value: number) => {
    if (!isMounted) return "00";
    return String(value).padStart(2, "0");
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-4.5 backdrop-blur-xl shadow-[0_24px_50px_rgba(0,0,0,0.3)] select-none">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${timeLeft.isOver ? "bg-emerald-400" : "bg-orange-400"}`}></span>
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${timeLeft.isOver ? "bg-emerald-500" : "bg-orange-500"}`}></span>
        </span>
        <span className="text-xs font-bold tracking-wider uppercase text-white/70">
          {timeLeft.isOver ? currentLabel.live : currentLabel.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <TimeSegment
          value={renderDigits(timeLeft.days)}
          label={currentLabel.days}
          glowColor="from-orange-500/20"
        />
        <TimeSegment
          value={renderDigits(timeLeft.hours)}
          label={currentLabel.hours}
          glowColor="from-amber-500/20"
        />
        <TimeSegment
          value={renderDigits(timeLeft.minutes)}
          label={currentLabel.minutes}
          glowColor="from-yellow-500/20"
        />
        <TimeSegment
          value={renderDigits(timeLeft.seconds)}
          label={currentLabel.seconds}
          glowColor="from-rose-500/20"
          pulse={isMounted && !timeLeft.isOver}
        />
      </div>
    </div>
  );
}

function TimeSegment({
  value,
  label,
  glowColor,
  pulse = false,
}: {
  value: string;
  label: string;
  glowColor: string;
  pulse?: boolean;
}) {
  return (
    <div className="group relative flex flex-col items-center justify-center rounded-xl border border-white/8 bg-gradient-to-b from-white/10 to-white/2 py-2.5 shadow-inner transition-all duration-300 hover:border-white/20 hover:bg-white/10">
      <div className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-t ${glowColor} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}></div>
      <span className={`font-mono text-3xl font-black tracking-tight text-white ${pulse ? "animate-[pulse_1s_infinite]" : ""}`}>
        {value}
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/50 group-hover:text-white/70 transition-colors">
        {label}
      </span>
    </div>
  );
}
