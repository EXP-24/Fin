import { useEffect, useRef, useState } from "react";
import { getEffects } from "../theme.js";
import { createPointer, createShooter } from "./starEffects.js";

// Interactive galaxy backdrop.
//  - 3 depth layers of twinkling stars that drift and shift (parallax) with the cursor
//  - stars gently part around the cursor, and nearby stars link into a constellation
//  - occasional shooting star (dark theme)
//  - also publishes --mx/--my (page spotlight) and --gx/--gy (per-card glow) as CSS vars
// Honors prefers-reduced-motion and the "Hiệu ứng nền" setting: both render a still sky.
const PALETTE = [215, 245, 270, 300, 190];
const LAYERS = [
  { n: 0.55, size: [0.3, 0.8], alpha: 0.55, depth: 6, drift: 0.004 },
  { n: 0.33, size: [0.6, 1.3], alpha: 0.8, depth: 16, drift: 0.009 },
  { n: 0.12, size: [1.1, 2.1], alpha: 1, depth: 34, drift: 0.016 },
];

function useEffectsOn() {
  const [on, setOn] = useState(getEffects);
  useEffect(() => {
    const sync = () => setOn(getEffects());
    window.addEventListener("finsight:prefs", sync);
    return () => window.removeEventListener("finsight:prefs", sync);
  }, []);
  return on;
}

export default function Starfield() {
  const ref = useRef(null);
  const fx = useEffectsOn();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animated = fx && !reduce;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const root = document.documentElement;

    let w = 0;
    let h = 0;
    let stars = [];
    let raf = 0;
    const shooter = createShooter();
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, nx: 0, ny: 0, tnx: 0, tny: 0, active: false };

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const total = Math.min(340, Math.floor((w * h) / 4800));
      stars = [];
      LAYERS.forEach((layer, li) => {
        const count = Math.floor(total * layer.n);
        for (let i = 0; i < count; i += 1) {
          stars.push({
            li,
            x: Math.random() * w,
            y: Math.random() * h,
            r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
            phase: Math.random() * Math.PI * 2,
            speed: 0.0006 + Math.random() * 0.0018,
            hue: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            spark: li === 2 && Math.random() < 0.45,
          });
        }
      });
    }

    function draw(now) {
      const dark = root.classList.contains("dark");
      ctx.clearRect(0, 0, w, h);

      if (animated) {
        mouse.x += (mouse.tx - mouse.x) * 0.16;
        mouse.y += (mouse.ty - mouse.y) * 0.16;
        mouse.nx += (mouse.tnx - mouse.nx) * 0.06;
        mouse.ny += (mouse.tny - mouse.ny) * 0.06;
      }

      const pts = [];
      for (const s of stars) {
        const layer = LAYERS[s.li];
        if (animated) {
          s.y -= layer.drift * 6;
          if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
        }
        let x = s.x - mouse.nx * layer.depth;
        let y = s.y - mouse.ny * layer.depth;
        let near = 0;
        if (animated && mouse.active) {
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 130) {
            near = 1 - d / 130;
            const push = near * near * 22;
            x += (dx / (d || 1)) * push;
            y += (dy / (d || 1)) * push;
          }
        }
        const tw = animated ? 0.55 + 0.45 * Math.sin(now * s.speed + s.phase) : 0.85;
        const a = layer.alpha * (0.35 + 0.65 * tw) * (1 + near * 0.6);
        ctx.beginPath();
        ctx.fillStyle = dark
          ? `hsla(${s.hue}, 95%, ${82 + near * 10}%, ${Math.min(1, a)})`
          : `hsla(${s.hue + 15}, 75%, 50%, ${Math.min(0.55, a * 0.35)})`;
        ctx.arc(x, y, s.r * (1 + near * 0.5), 0, Math.PI * 2);
        ctx.fill();

        if (dark && s.li > 0) {
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue}, 100%, 75%, ${0.05 * tw * layer.alpha})`;
          ctx.arc(x, y, s.r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (dark && s.spark) {
          const len = s.r * (5 + 4 * tw);
          ctx.strokeStyle = `hsla(${s.hue}, 100%, 90%, ${0.55 * tw})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
          ctx.stroke();
        }
        if (near > 0.05) pts.push({ x, y, near });
      }

      // Constellation: link stars that are close to the cursor and to each other.
      if (animated && pts.length > 1) {
        for (let i = 0; i < pts.length; i += 1) {
          for (let j = i + 1; j < pts.length; j += 1) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (d < 120) {
              const a = (1 - d / 120) * Math.min(pts[i].near, pts[j].near) * 1.4;
              ctx.strokeStyle = dark ? `rgba(160,150,255,${Math.min(0.55, a)})` : `rgba(88,70,235,${Math.min(0.3, a * 0.6)})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.stroke();
            }
          }
        }
      }

      if (animated && dark) shooter.draw(ctx, now, w, h);
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    const pointer = createPointer(mouse, () => ({ w, h }));

    const redraw = () => draw(0);
    resize();
    window.addEventListener("resize", resize);
    if (animated) {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", pointer.onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", pointer.onLeave);
    } else {
      draw(0);
      window.addEventListener("finsight:prefs", redraw);
    }
    return () => {
      window.removeEventListener("finsight:prefs", redraw);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointer.onMove);
      document.documentElement.removeEventListener("pointerleave", pointer.onLeave);
      pointer.dispose();
    };
  }, [fx]);

  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none" />;
}
