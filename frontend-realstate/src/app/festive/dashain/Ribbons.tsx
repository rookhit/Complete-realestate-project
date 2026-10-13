import { useEffect, useRef } from "react";
import { PALETTE } from "./config";

// Falling festival ribbons and marigold petals, drawn on a full-screen canvas. Each ribbon is a strip
// that twists along its length: segment widths follow cos(), and a segment shows its darker back
// when the twist turns it away, which reads as 3D. Petals tumble (squash on one axis). The shower
// runs for `seconds`, then pieces fall out and the loop stops on its own.

type Piece = {
  kind: "ribbon" | "petal";
  x: number; y: number; vx: number; vy: number;
  angle: number; spin: number;
  phase: number; phaseSpeed: number;
  sway: number; swaySpeed: number;
  len: number; width: number;
  front: string; back: string;
};

const RIBBON_COLOURS: [string, string][] = [
  [PALETTE.sindoor, "#8e1820"],
  [PALETTE.marigold, "#b4600f"],
  [PALETTE.saffron, "#c4880b"],
  [PALETTE.gold, "#9c7a33"],
  [PALETTE.jamara, PALETTE.jamaraDeep],
  [PALETTE.cream, "#cbbfa8"],
];
const PETAL_COLOURS: [string, string][] = [
  [PALETTE.marigold, "#c2690f"],
  [PALETTE.saffron, "#d08f0c"],
  ["#e5521f", "#a83812"],
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function makePiece(w: number, h: number, scatterY: boolean, scale: number): Piece {
  const ribbon = Math.random() < 0.72;
  const [front, back] = pick(ribbon ? RIBBON_COLOURS : PETAL_COLOURS);
  return {
    kind: ribbon ? "ribbon" : "petal",
    x: rand(-0.05, 1.05) * w,
    y: scatterY ? rand(-h * 0.9, -20) : rand(-120, -20),
    vx: rand(-0.6, 0.6), vy: rand(1.2, 2.6),
    angle: rand(0, Math.PI * 2), spin: rand(-0.04, 0.04),
    phase: rand(0, Math.PI * 2), phaseSpeed: rand(0.06, 0.14),
    sway: rand(0, Math.PI * 2), swaySpeed: rand(0.012, 0.03),
    len: (ribbon ? rand(26, 46) : rand(9, 14)) * scale,
    width: (ribbon ? rand(5, 8) : rand(6, 10)) * scale,
    front, back,
  };
}

function drawRibbon(ctx: CanvasRenderingContext2D, p: Piece) {
  const SEG = 6;
  const step = p.len / SEG;
  const dx = Math.cos(p.angle), dy = Math.sin(p.angle);
  // The strip's spine waves a little, like paper ribbon in air.
  for (let i = 0; i < SEG; i++) {
    const t0 = i * step - p.len / 2, t1 = (i + 1) * step - p.len / 2;
    const wave0 = Math.sin(p.phase * 0.7 + i * 0.9) * p.width * 0.45;
    const wave1 = Math.sin(p.phase * 0.7 + (i + 1) * 0.9) * p.width * 0.45;
    const tw0 = Math.cos(p.phase + i * 0.42), tw1 = Math.cos(p.phase + (i + 1) * 0.42);
    const ax = p.x + dx * t0 - dy * wave0, ay = p.y + dy * t0 + dx * wave0;
    const bx = p.x + dx * t1 - dy * wave1, by = p.y + dy * t1 + dx * wave1;
    const w0 = (p.width / 2) * tw0, w1 = (p.width / 2) * tw1;
    ctx.fillStyle = (tw0 + tw1) / 2 >= 0 ? p.front : p.back;
    ctx.beginPath();
    ctx.moveTo(ax - dy * w0, ay + dx * w0);
    ctx.lineTo(bx - dy * w1, by + dx * w1);
    ctx.lineTo(bx + dy * w1, by - dx * w1);
    ctx.lineTo(ax + dy * w0, ay - dx * w0);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Piece) {
  const flip = Math.cos(p.phase);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.scale(1, Math.max(0.15, Math.abs(flip)));
  ctx.fillStyle = flip >= 0 ? p.front : p.back;
  ctx.beginPath();
  // A marigold petal: rounded at the tip, pinched at the base.
  ctx.moveTo(0, -p.len / 2);
  ctx.bezierCurveTo(p.width / 2, -p.len / 2, p.width / 2, p.len / 4, 0, p.len / 2);
  ctx.bezierCurveTo(-p.width / 2, p.len / 4, -p.width / 2, -p.len / 2, 0, -p.len / 2);
  ctx.fill();
  ctx.restore();
}

export function Ribbons({ seconds = 7 }: { seconds?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Fewer, smaller pieces on phones: same feel, less work.
    const phone = w < 640;
    const scale = phone ? 0.8 : 1;
    const max = phone ? 110 : 220;
    const pieces: Piece[] = Array.from({ length: Math.round(max * 0.55) }, () => makePiece(w, h, true, scale));
    const start = performance.now();
    let last = start, raf = 0;

    const frame = (now: number) => {
      // Frame time in 60 fps units, capped so a background tab doesn't teleport the pieces.
      const k = Math.min((now - last) / 16.67, 3);
      last = now;
      const running = (now - start) / 1000 < seconds;
      if (running && pieces.length < max) for (let i = 0; i < (phone ? 1 : 2); i++) pieces.push(makePiece(w, h, false, scale));

      ctx.clearRect(0, 0, w, h);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.sway += p.swaySpeed * k;
        p.vx += Math.sin(p.sway) * 0.035 * k;
        p.vy += 0.045 * k;
        p.vx *= Math.pow(0.985, k); p.vy *= Math.pow(0.975, k);
        p.x += p.vx * k; p.y += p.vy * k;
        p.angle += p.spin * k; p.phase += p.phaseSpeed * k;
        if (p.y - p.len > h) { pieces.splice(i, 1); continue; }
        if (p.kind === "ribbon") drawRibbon(ctx, p); else drawPetal(ctx, p);
      }
      if (running || pieces.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [seconds]);

  return <canvas ref={canvas} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" />;
}
