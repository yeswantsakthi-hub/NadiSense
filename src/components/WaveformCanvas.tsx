import { useEffect, useRef } from 'react';
import type { RingBuffer } from '../lib/RingBuffer';

interface Props {
  buffer: RingBuffer;
  /** Visible time span in ms. */
  windowMs?: number;
  /** Draw the signal upside down (raw PPG light dips when blood volume rises). */
  invert?: boolean;
  /** CSS colour variable for the trace. */
  colorVar?: string;
  className?: string;
  label: string;
  /** Time ranges to shade (e.g. motion-flagged segments); `to: null` means still open. Read every frame. */
  getBands?: () => readonly { from: number; to: number | null }[];
  /** Smallest vertical range in signal units, so a quiet signal isn't blown up into noise. */
  minSpan?: number;
  /** Draw ECG-paper grid lines. */
  grid?: boolean;
  /** Ignore band samples when fitting the vertical scale (artifacts get clipped). */
  excludeBandsFromScale?: boolean;
}

/**
 * Scrolling real-time waveform. Draws straight from a RingBuffer on requestAnimationFrame,
 * so 400 Hz data never goes through React state.
 */
export function WaveformCanvas({
  buffer,
  windowMs = 5000,
  invert = false,
  colorVar = '--signal',
  className = '',
  label,
  getBands,
  minSpan = 0,
  grid = true,
  excludeBandsFromScale = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const colors = {
      trace: '#EF3B36',
      grid: 'rgba(239,59,54,0.07)',
      gridStrong: 'rgba(239,59,54,0.17)',
      band: 'rgba(242,162,58,0.13)',
      bandEdge: '#F2A23A',
    };
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      colors.trace = read(colorVar, colors.trace);
      colors.grid = read('--grid', colors.grid);
      colors.gridStrong = read('--grid-strong', colors.gridStrong);
      colors.band = read('--band', colors.band);
      colors.bandEdge = read('--amber', colors.bandEdge);
    };
    readColors();
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    darkQuery.addEventListener('change', readColors);

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

    // Smoothed vertical range so the trace doesn't jump when one beat is taller.
    let lo = NaN;
    let hi = NaN;
    let lastDraw = 0;
    let frame = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      // Reduced motion: no continuous scrolling, refresh the snapshot once a second.
      if (motionQuery.matches && now - lastDraw < 1000) return;
      lastDraw = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (buffer.length < 2 || width === 0) return;

      // Run a little behind the newest sample so packets arriving in bursts still scroll smoothly.
      const sinceArrival = Math.min(now - buffer.lastPushAt, 500);
      const right = buffer.lastTime + sinceArrival - 120;
      const left = right - windowMs;
      const x = (t: number) => ((t - left) / windowMs) * width;

      const bands = getBands?.() ?? [];
      const flagged = (t: number) => bands.some((b) => t >= b.from && t <= (b.to ?? right));
      if (bands.length) {
        for (const band of bands) {
          const to = band.to ?? right;
          if (to < left || band.from > right) continue;
          const x0 = Math.max(0, x(band.from));
          const x1 = Math.min(width, x(to));
          ctx.fillStyle = colors.band;
          ctx.fillRect(x0, 0, x1 - x0, height);
          ctx.fillStyle = colors.bandEdge;
          ctx.fillRect(x0, 0, x1 - x0, 2);
        }
      }

      if (grid) {
        // Grid that scrolls with the signal, like ECG paper: 200 ms minor, 1 s major.
        for (let g = Math.ceil(left / 200) * 200; g <= right; g += 200) {
          ctx.fillStyle = g % 1000 === 0 ? colors.gridStrong : colors.grid;
          ctx.fillRect(Math.round(x(g)), 0, 1, height);
        }
        for (let i = 1; i < 4; i++) {
          ctx.fillStyle = colors.grid;
          ctx.fillRect(0, Math.round((height * i) / 4), width, 1);
        }
      }

      let first = buffer.length - 1;
      while (first > 0 && buffer.timeAt(first - 1) >= left) first--;
      if (first > 0) first--;
      let last = buffer.length - 1;
      while (last > first && buffer.timeAt(last) > right) last--;
      if (last - first < 2) return;

      let min = Infinity;
      let max = -Infinity;
      const fitScale = (skipFlagged: boolean) => {
        for (let i = first; i <= last; i++) {
          if (skipFlagged && flagged(buffer.timeAt(i))) continue;
          const v = buffer.valueAt(i);
          if (v < min) min = v;
          if (v > max) max = v;
        }
      };
      // Fit to clean signal so a motion artifact doesn't squash the pulse; the artifact gets clipped instead.
      fitScale(excludeBandsFromScale);
      if (min > max) fitScale(false);
      if (max - min < minSpan) {
        const mid = (max + min) / 2;
        min = mid - minSpan / 2;
        max = mid + minSpan / 2;
      }
      if (Number.isNaN(lo) || motionQuery.matches) {
        lo = min;
        hi = max;
      } else {
        lo += (min - lo) * (min < lo ? 0.3 : 0.05);
        hi += (max - hi) * (max > hi ? 0.3 : 0.05);
      }
      const span = Math.max(hi - lo, 1e-9);
      const pad = height * 0.14;
      const y = (v: number) => {
        const n = (v - lo) / span;
        return pad + (invert ? n : 1 - n) * (height - 2 * pad);
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // Flagged stretches are drawn faded in amber so they don't read as signal.
      const styleFor = (isFlagged: boolean) => {
        ctx.strokeStyle = isFlagged ? colors.bandEdge : colors.trace;
        ctx.globalAlpha = isFlagged ? 0.45 : 1;
      };
      let inBand = bands.length > 0 && flagged(buffer.timeAt(first));
      styleFor(inBand);
      ctx.moveTo(x(buffer.timeAt(first)), y(buffer.valueAt(first)));
      for (let i = first + 1; i <= last; i++) {
        const px = x(buffer.timeAt(i));
        const py = y(buffer.valueAt(i));
        ctx.lineTo(px, py);
        const nowFlagged = bands.length > 0 && flagged(buffer.timeAt(i));
        if (nowFlagged !== inBand) {
          ctx.stroke();
          inBand = nowFlagged;
          styleFor(inBand);
          ctx.beginPath();
          ctx.moveTo(px, py);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Leading-edge marker.
      const hx = x(buffer.timeAt(last));
      const hy = y(buffer.valueAt(last));
      ctx.fillStyle = colors.trace;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      darkQuery.removeEventListener('change', readColors);
    };
  }, [buffer, windowMs, invert, colorVar, getBands, minSpan, grid, excludeBandsFromScale]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className={`block w-full ${className}`} />;
}
