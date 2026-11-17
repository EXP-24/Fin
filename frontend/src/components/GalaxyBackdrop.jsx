import { useEffect, useRef, useState } from "react";
import { getEffects } from "../theme.js";
import { createPointer, createShooter } from "./starEffects.js";

// Login-only backdrop. Same space concept as <Starfield />, but a different scene:
// an evenly spread, slowly rotating star field with finance motifs (price line, metric tags).
// Honors prefers-reduced-motion and the "Hiệu ứng nền" setting.
const HUES = [215, 245, 270, 300, 190];
const LABEL_PAD = 200; // off-screen margin so tags enter/leave smoothly
const DEPTH = [{ depth: 6, drift: 0.004 }, { depth: 16, drift: 0.009 }, { depth: 34, drift: 0.016 }];

function useEffectsOn() {
  const [on, setOn] = useState(getEffects);
  useEffect(() => {
    const sync = () => setOn(getEffects());
    window.addEventListener("finsight:prefs", sync);
    return () => window.removeEventListener("finsight:prefs", sync);
  }, []);
  return on;
}

export default function GalaxyBackdrop() {
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
    let cx = 0;
    let cy = 0;
    let R = 0;
    let stars = [];
    let bg = [];
    let labels = [];
    let lanePeriod = 1;
    let lineSeed = [0, 0, 0];
    let raf = 0;
    const shooter = createShooter();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, active: false };

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w * 0.5;
      cy = h * 0.5;
      R = Math.hypot(w, h) * 0.5;

      // Evenly spread stars: a jittered grid over the screen (one random star per cell), so every
      // visit differs but nothing clumps. Like the chat backdrop, they drift upward in 3 depth layers.
      const cell = 78;
      stars = [];
      for (let gx = 0; gx < w; gx += cell) {
        for (let gy = 0; gy < h; gy += cell) {
          const li = Math.floor(Math.random() * 3);
          stars.push({
            x: gx + Math.random() * cell,
            y: gy + Math.random() * cell,
            li,
            size: 0.4 + Math.random() * 0.7 + li * 0.35,
            hue: HUES[Math.floor(Math.random() * HUES.length)],
            phase: Math.random() * Math.PI * 2,
            speed: 0.001 + Math.random() * 0.002,
          });
        }
      }
      bg = Array.from({ length: Math.floor((w * h) / 9000) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 0.9 + 0.2, phase: Math.random() * 6.28,
      }));
      const rnd = (a, b) => a + Math.random() * (b - a);

      // Financial motifs: metric tags in separate rows. Every tag moves at the same speed and the
      // spacing inside a row is wider than any tag, so tags can never overlap (also across the wrap).
      const names = ["Doanh thu", "Lợi nhuận", "Tổng tài sản", "ROE", "EPS", "Dòng tiền", "Nợ phải trả", "Biên LN gộp", "Vốn chủ sở hữu", "ROA"];
      labels = [];
      const rowGap = 260;
      const colGap = 380; // > widest tag (~190px) + margin
      lanePeriod = Math.max(1, Math.ceil((w + 2 * LABEL_PAD) / colGap)) * colGap;
      const perRow = lanePeriod / colGap;
      for (let gy = rowGap / 2; gy < h; gy += rowGap) {
        const rowOffset = Math.random() * colGap;
        const y = gy + (Math.random() - 0.5) * 60;
        for (let i = 0; i < perRow; i += 1) {
          const v = (Math.random() * 30 - 8).toFixed(1);
          labels.push({
            x0: rowOffset + i * colGap + (Math.random() - 0.5) * 40,
            y,
            text: `${names[Math.floor(Math.random() * names.length)]}  ${v >= 0 ? "+" : ""}${v}%`,
            up: v >= 0,
            phase: Math.random() * 6.28,
          });
        }
      }
      lineSeed = [Math.random() * 100, Math.random() * 100, Math.random() * 100];
    }

    function draw(now) {
      const dark = root.classList.contains("dark");
      ctx.clearRect(0, 0, w, h);
      if (animated) {
        mouse.x += (mouse.tx - mouse.x) * 0.16;
        mouse.y += (mouse.ty - mouse.y) * 0.16;
      }
      // Gentle parallax toward the cursor.
      const px = (mouse.x / w - 0.5) * 24;
      const py = (mouse.y / h - 0.5) * 24;
      const ox = cx + px;
      const oy = cy + py;

      // Faint backdrop stars (static, twinkling).
      for (const b of bg) {
        const tw = animated ? 0.5 + 0.5 * Math.sin(now * 0.0015 + b.phase) : 0.8;
        ctx.fillStyle = dark ? `rgba(220,225,255,${0.15 + 0.4 * tw})` : `rgba(90,80,200,${0.08 + 0.12 * tw})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 6.283);
        ctx.fill();
      }

      // Price-style line scrolling along the lower part of the screen.
      {
        const t = animated ? now * 0.00004 : 0;
        const base = h * 0.8;
        const amp = h * 0.05;
        const yAt = (x) => {
          const u = x / w * 6 + t * 6;
          return base + amp * (Math.sin(u + lineSeed[0]) * 0.6 + Math.sin(u * 2.3 + lineSeed[1]) * 0.3 + Math.sin(u * 5.1 + lineSeed[2]) * 0.1);
        };
        const rgb = dark ? "150,160,255" : "88,70,235";
        ctx.beginPath();
        ctx.moveTo(0, yAt(0));
        for (let x = 8; x <= w + 8; x += 8) ctx.lineTo(x, yAt(x));
        ctx.strokeStyle = `rgba(${rgb},${dark ? 0.28 : 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineTo(w + 8, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, base - amp, 0, h);
        fill.addColorStop(0, `rgba(${rgb},${dark ? 0.1 : 0.06})`);
        fill.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = fill;
        ctx.fill();
        const ex = w * 0.88;
        const ey = yAt(ex);
        const pulse = animated ? 0.5 + 0.5 * Math.sin(now * 0.003) : 0.7;
        ctx.fillStyle = `rgba(${dark ? "120,230,255" : "20,150,200"},${0.25 + 0.2 * pulse})`;
        ctx.beginPath();
        ctx.arc(ex, ey, 9 + 3 * pulse, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = dark ? "rgb(170,240,255)" : "rgb(20,150,200)";
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, 6.283);
        ctx.fill();
      }

      // Drifting financial metric tags.
      ctx.font = "500 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textBaseline = "middle";
      const shift = animated ? now * 0.012 : 0; // common speed (~12 px/s) keeps spacing fixed
      for (const l of labels) {
        const x = ((((l.x0 + shift) % lanePeriod) + lanePeriod) % lanePeriod) - LABEL_PAD;
        const tw = animated ? 0.6 + 0.4 * Math.sin(now * 0.0008 + l.phase) : 0.8;
        const c = l.up ? (dark ? "130,235,200" : "10,150,110") : (dark ? "255,150,170" : "200,50,80");
        ctx.fillStyle = `rgba(${c},${(dark ? 0.32 : 0.34) * tw})`;
        ctx.fillText(l.text, x, l.y);
      }

      // Stars drift upward (wrapping at the top) with cursor parallax per depth layer.
      const pts = [];
      for (const s of stars) {
        const layer = DEPTH[s.li];
        if (animated) {
          s.y -= layer.drift * 6;
          if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
        }
        let x = s.x - (mouse.x / w - 0.5) * layer.depth;
        let y = s.y - (mouse.y / h - 0.5) * layer.depth;
        // Stars part gently around the cursor.
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
        const alpha = 0.75 * (0.4 + 0.6 * tw) * (1 + near * 0.6);
        ctx.fillStyle = dark
          ? `hsla(${s.hue}, 95%, ${84 + s.li * 4}%, ${Math.min(1, alpha)})`
          : `hsla(${s.hue + 15}, 75%, 50%, ${Math.min(0.5, alpha * 0.45)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size * (1 + near * 0.5), 0, 6.283);
        ctx.fill();
        if (near > 0.05) pts.push({ x, y, near });
      }

      // Constellation: link stars near the cursor and to each other.
      if (animated && pts.length > 1) {
        for (let i = 0; i < pts.length; i += 1) {
          for (let j = i + 1; j < pts.length; j += 1) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (d < 120) {
              const al = (1 - d / 120) * Math.min(pts[i].near, pts[j].near) * 1.4;
              ctx.strokeStyle = dark ? `rgba(160,150,255,${Math.min(0.55, al)})` : `rgba(88,70,235,${Math.min(0.3, al * 0.6)})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // Shooting star (dark theme).
      if (animated && dark) shooter.draw(ctx, now, w, h);
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    const pointer = createPointer(mouse, () => ({ w, h }));

    const redraw = () => draw(0);
    mouse.x = mouse.tx = window.innerWidth / 2;
    mouse.y = mouse.ty = window.innerHeight / 2;
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
