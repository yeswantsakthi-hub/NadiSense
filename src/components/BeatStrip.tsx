import { useEffect, useRef } from 'react';
import { ppgPulse } from '../data/mockModel';
import { beatLog } from '../store/liveStore';

interface Props {
  label: string;
  windowMs?: number;
  className?: string;
  /** CSS colour variable for the trace. */
  colorVar?: string;
}

/**
 * Scrolling pulse strip. The v1 ring sends beat times, not a raw waveform, so each beat the ring
 * reports is drawn as one stylised pulse at its real time. No beats → a flat line; nothing invented.
 * Beats flagged for movement are drawn in the warning colour.
 */
export function BeatStrip({ label, windowMs = 6000, className = '', colorVar = '--signal' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const trace = color(colorVar, '#e5484d');
    const warn = color('--amber', '#e8b44c');
    const grid = color('--grid', 'rgba(255,255,255,0.05)');

    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    let lastDraw = 0;
    const draw = (perfNow: number) => {
      frame = requestAnimationFrame(draw);
      if (motionQuery.matches && perfNow - lastDraw < 1000) return;
      lastDraw = perfNow;

      const now = Date.now();
      const left = now - windowMs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!width) return;

      ctx.fillStyle = grid;
      for (let g = Math.ceil(left / 1000) * 1000; g <= now; g += 1000) {
        ctx.fillRect(Math.round(((g - left) / windowMs) * width), 0, 1, height);
      }
      for (let r = 1; r < 4; r++) ctx.fillRect(0, Math.round((height * r) / 4), width, 1);

      // Only beats that can still be on screen.
      const beats = beatLog.filter((b) => b.at > left - 1500);
      const base = height * 0.8;
      const amp = height * 0.62;
      const yAt = (t: number) => {
        let v = 0;
        let motion = false;
        for (const b of beats) {
          const tau = (t - b.at) / 1000;
          if (tau < 0 || tau > 1.4) continue;
          const p = ppgPulse(tau, b.rrMs);
          v += p;
          if (b.motion && p > 0.05) motion = true;
        }
        return { y: base - Math.min(1.3, v) * amp, motion };
      };

      // Soft fill under the trace.
      const fill = ctx.createLinearGradient(0, height * 0.1, 0, height);
      fill.addColorStop(0, trace);
      fill.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) ctx.lineTo(x, yAt(left + (x / width) * windowMs).y);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();

      ctx.lineWidth = 2.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let current: boolean | null = null;
      for (let x = 0; x <= width; x += 1) {
        const t = left + (x / width) * windowMs;
        const { y, motion } = yAt(t);
        if (motion !== current) {
          if (current !== null) ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = motion ? warn : trace;
          ctx.moveTo(x, y);
          current = motion;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const head = yAt(now);
      ctx.fillStyle = head.motion ? warn : trace;
      ctx.beginPath();
      ctx.arc(width - 4, head.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(width - 4, head.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [windowMs, colorVar]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className={`block w-full ${className}`} />;
}
