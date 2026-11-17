// Interaction + effects shared by the two animated backdrops (Starfield for the app,
// GalaxyBackdrop for the login screen), so cursor behaviour stays identical in both.

const GLOW_SELECTOR = ".bg-surface-container-lowest, .bg-surface-container-low, .bg-surface-container";

/**
 * Pointer tracking. Writes into `mouse` (tx/ty = target, tnx/tny = normalised -0.5..0.5,
 * active) and publishes the page spotlight (--mx/--my) and per-card glow (--gx/--gy).
 * The backdrop smooths mouse.x/y toward tx/ty itself each frame.
 * Returns { onMove, onLeave, dispose }.
 */
export function createPointer(mouse, getSize) {
  const root = document.documentElement;
  let pending = null;
  let glowTarget = null;

  function clearGlow() {
    if (!glowTarget) return;
    glowTarget.style.removeProperty("--gx");
    glowTarget.style.removeProperty("--gy");
    glowTarget = null;
  }

  function flush() {
    const e = pending;
    pending = null;
    if (!e) return;
    const { w, h } = getSize();
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    mouse.tnx = e.clientX / w - 0.5;
    mouse.tny = e.clientY / h - 0.5;
    if (!mouse.active) { mouse.x = e.clientX; mouse.y = e.clientY; } // no sweep in from off-screen
    mouse.active = true;
    root.style.setProperty("--mx", `${e.clientX}px`);
    root.style.setProperty("--my", `${e.clientY}px`);
    const card = e.target instanceof Element ? e.target.closest(GLOW_SELECTOR) : null;
    if (glowTarget && glowTarget !== card) clearGlow();
    glowTarget = card;
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--gx", `${e.clientX - r.left}px`);
      card.style.setProperty("--gy", `${e.clientY - r.top}px`);
    }
  }

  return {
    onMove(e) {
      pending = e;
      requestAnimationFrame(flush);
    },
    onLeave() {
      mouse.active = false;
      mouse.tnx = 0;
      mouse.tny = 0;
      clearGlow();
    },
    dispose: clearGlow,
  };
}

/** Occasional shooting star (call draw() each frame, dark theme only). */
export function createShooter() {
  let shooter = null;
  let nextShot = performance.now() + 3500;
  return {
    draw(ctx, now, w, h) {
      if (!shooter && now > nextShot) {
        shooter = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.35, vx: 8 + Math.random() * 5, vy: 3 + Math.random() * 3, life: 1 };
      }
      if (!shooter) return;
      const tail = 11;
      const grad = ctx.createLinearGradient(shooter.x, shooter.y, shooter.x - shooter.vx * tail, shooter.y - shooter.vy * tail);
      grad.addColorStop(0, `rgba(255,255,255,${shooter.life})`);
      grad.addColorStop(0.3, `rgba(170,150,255,${0.6 * shooter.life})`);
      grad.addColorStop(1, "rgba(120,100,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shooter.x, shooter.y);
      ctx.lineTo(shooter.x - shooter.vx * tail, shooter.y - shooter.vy * tail);
      ctx.stroke();
      shooter.x += shooter.vx;
      shooter.y += shooter.vy;
      shooter.life -= 0.011;
      if (shooter.life <= 0 || shooter.x > w + 60 || shooter.y > h + 60) {
        shooter = null;
        nextShot = now + 4500 + Math.random() * 6500;
      }
    },
  };
}
