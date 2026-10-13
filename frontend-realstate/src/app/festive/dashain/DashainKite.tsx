import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./config";

// A 3D changa (Nepali kite) flying over the page during Dashain. three.js, loaded only by this
// festival module. The kite is a fine mesh that bows back like paper on a bamboo frame and flutters
// at the edges; two paper streamers hang from it (verlet chains) and a string runs to the corner.
// Scrolling down makes it climb and drift across the sky; a fast scroll tugs it and it settles on a
// spring. pointer-events: none, so it never gets in the way. Reduced motion: it holds still.

const GRID = 14;
// Kite outline in its own units (height ≈ 2.25): top, right, bottom, left.
const CORNERS = [new THREE.Vector2(0, 1.0), new THREE.Vector2(1.0, 0.12), new THREE.Vector2(0, -1.25), new THREE.Vector2(-1.0, 0.12)];
const KITE_HEIGHT = 2.25;
const BOW = 0.24;

/** The kite paper: saffron and sindoor halves, a gold border, a white moon with a tika, paper fibres. */
function paperTexture(): THREE.CanvasTexture {
  const S = 512, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  // uv (0,0) = the kite's top point, (1,1) = its bottom point: the spine is this diagonal.
  g.fillStyle = PALETTE.saffron; g.fillRect(0, 0, S, S);
  g.fillStyle = PALETTE.sindoor;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(S, S); g.closePath(); g.fill();
  // A darker band where the halves meet, like a pasted seam.
  g.strokeStyle = "rgba(90,20,10,0.35)"; g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.stroke();
  // Gold border with a thin maroon inner line.
  g.strokeStyle = PALETTE.gold; g.lineWidth = 34; g.strokeRect(0, 0, S, S);
  g.strokeStyle = PALETTE.maroon; g.lineWidth = 4; g.strokeRect(30, 30, S - 60, S - 60);
  // The moon and the tika at the centre.
  g.fillStyle = PALETTE.cream; g.beginPath(); g.arc(S / 2, S / 2, 78, 0, Math.PI * 2); g.fill();
  g.strokeStyle = PALETTE.gold; g.lineWidth = 6; g.stroke();
  const tika = g.createRadialGradient(S / 2 - 8, S / 2 - 10, 4, S / 2, S / 2, 34);
  tika.addColorStop(0, "#ff5a4f"); tika.addColorStop(1, "#9a1b22");
  g.fillStyle = tika; g.beginPath(); g.arc(S / 2, S / 2, 32, 0, Math.PI * 2); g.fill();
  // Paper fibres and a little unevenness, so it reads as paper, not plastic.
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    g.lineWidth = 1;
    const x = Math.random() * S, y = Math.random() * S, a = Math.random() * Math.PI, l = 6 + Math.random() * 18;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The kite surface: a GRID×GRID mesh spread over the four corners (bilinear), so it can bend. */
function kiteGeometry(): { geo: THREE.BufferGeometry; base: Float32Array } {
  const [top, right, bottom, left] = CORNERS;
  const pos: number[] = [], uv: number[] = [], index: number[] = [];
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const u = i / GRID, v = j / GRID;
      const x = (1 - u) * (1 - v) * top.x + u * (1 - v) * right.x + u * v * bottom.x + (1 - u) * v * left.x;
      const y = (1 - u) * (1 - v) * top.y + u * (1 - v) * right.y + u * v * bottom.y + (1 - u) * v * left.y;
      pos.push(x, y, 0); uv.push(u, v);
    }
  }
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * (GRID + 1) + i, b = a + 1, c = a + GRID + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return { geo, base: new Float32Array(pos) };
}

/** A paper streamer: a chain of points (verlet) drawn as a strip. */
class Streamer {
  points: THREE.Vector3[]; prev: THREE.Vector3[];
  geo: THREE.BufferGeometry; mesh: THREE.Mesh;
  seed = Math.random() * Math.PI * 2;
  constructor(public n: number, public seg: number, public width: number, colour: string) {
    this.points = Array.from({ length: n }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n }, () => new THREE.Vector3());
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const index: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(index);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    this.mesh.frustumCulled = false;
  }
  reset(at: THREE.Vector3) { for (let i = 0; i < this.n; i++) { this.points[i].set(at.x, at.y - i * this.seg, at.z); this.prev[i].copy(this.points[i]); } }
  step(anchor: THREE.Vector3, gravity: number, wind: number, dt: number, t: number) {
    this.points[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const p = this.points[i], q = this.prev[i];
      const vx = (p.x - q.x) * 0.96, vy = (p.y - q.y) * 0.96;
      q.copy(p);
      // A ripple that travels down the streamer, stronger towards the free end: paper in wind.
      const ripple = wind === 0 ? 0 : Math.sin(t * 6.5 - i * 0.9 + this.seed) * 16 * (i / this.n);
      p.x += vx + (wind + ripple) * dt * dt; p.y += vy - gravity * dt * dt;
    }
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i < this.n; i++) {
        const a = this.points[i - 1], b = this.points[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, diff = (d - this.seg) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    }
    const attr = this.geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      const a = this.points[Math.max(0, i - 1)], b = this.points[Math.min(this.n - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const w = this.width * (1 - (i / this.n) * 0.55);
      attr.setXYZ(i * 2, this.points[i].x + nx * w, this.points[i].y + ny * w, this.points[i].z);
      attr.setXYZ(i * 2 + 1, this.points[i].x - nx * w, this.points[i].y - ny * w, this.points[i].z);
    }
    attr.needsUpdate = true;
  }
}

export default function DashainKite() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { return; } // No WebGL: the festival simply goes without a kite.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 20);
    scene.add(new THREE.HemisphereLight("#fff6e6", "#6b3a2a", 1.15));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(4, 6, 8);
    scene.add(sun);

    // The kite: paper, spine and bowed cross spar.
    const kite = new THREE.Group();
    const texture = paperTexture();
    const { geo, base } = kiteGeometry();
    const paper = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, transparent: true, opacity: 0.97 });
    kite.add(new THREE.Mesh(geo, paper));
    const bamboo = new THREE.MeshStandardMaterial({ color: "#b98a4c", roughness: 0.6 });
    const [top, right, bottom, left] = CORNERS;
    const spine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(top.x, top.y, 0.02), new THREE.Vector3(bottom.x, bottom.y, 0.02)), 8, 0.022, 6), bamboo);
    const spar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(left.x, left.y, -BOW + 0.02), new THREE.Vector3(0, left.y, BOW + 0.02), new THREE.Vector3(right.x, right.y, -BOW + 0.02)), 16, 0.02, 6), bamboo);
    kite.add(spine, spar);
    scene.add(kite);

    const streamers = [new Streamer(10, 0.12, 0.032, PALETTE.gold), new Streamer(8, 0.12, 0.028, PALETTE.sindoor)];
    const side = new THREE.Vector3();
    streamers.forEach(s => scene.add(s.mesh));
    const stringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, () => new THREE.Vector3()));
    // A warm mid-tone, so the string shows over the dark banner and the light sections alike.
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: "#8a6440", transparent: true, opacity: 0.6 }));
    string.frustumCulled = false;
    scene.add(string);

    // Screen size → world size at the kite's depth (z = 0).
    let W = 1, H = 1, viewH = 1, viewW = 1;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      viewW = viewH * camera.aspect;
    };
    resize();
    const world = (fx: number, fy: number, out = new THREE.Vector3()) => out.set((fx - 0.5) * viewW, (0.5 - fy) * viewH, 0);

    // Scroll: how far down the page (0-1) and how fast (px/s, smoothed).
    let progress = 0, lastY = window.scrollY, lastT = performance.now(), speed = 0;
    const readScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress = Math.min(1, Math.max(0, window.scrollY / max));
      const now = performance.now(), dt = Math.max(16, now - lastT);
      speed = speed * 0.6 + ((window.scrollY - lastY) / dt) * 1000 * 0.4;
      lastY = window.scrollY; lastT = now;
      if (still) render(performance.now());
    };

    // Kite state in screen fractions: position, velocity, and the tug from scrolling.
    const pos = new THREE.Vector2(0.95, 1.1), vel = new THREE.Vector2();
    let tug = 0, launch = 0, lastFrame = performance.now(), started = false;
    const anchorV = new THREE.Vector3(), bridle = new THREE.Vector3(), tail = new THREE.Vector3(), tmp = new THREE.Vector3();
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
      const t = now / 1000;
      const phone = W < 640;
      launch = still ? 1 : Math.min(1, launch + dt / 2.4);
      const rise = 1 - Math.pow(1 - launch, 3);
      tug = still ? 0 : Math.max(tug * Math.pow(0.12, dt), Math.min(1, Math.abs(speed) / 1600));
      speed *= Math.pow(0.05, dt);

      // Where it wants to be: higher and further left the further down the page you are.
      const gx = still ? 0 : 0.035 * Math.sin(t * 0.55) + 0.012 * Math.sin(t * 1.7 + 1.3);
      const gy = still ? 0 : 0.022 * Math.sin(t * 0.8 + 0.5) + 0.008 * Math.sin(t * 2.3);
      const tx = (phone ? 0.78 - 0.16 * progress : 0.8 - 0.17 * progress) + gx + (1 - rise) * 0.25;
      const ty = (phone ? 0.27 - 0.1 * progress : 0.3 - 0.15 * progress) + gy - tug * 0.05 + (1 - rise) * 0.85;
      if (still || !started) { pos.set(tx, ty); vel.set(0, 0); started = true; }
      else {
        const k = 22, c = 7.5; // a spring with a little overshoot, so tugs settle naturally
        vel.x += (k * (tx - pos.x) - c * vel.x) * dt; vel.y += (k * (ty - pos.y) - c * vel.y) * dt;
        pos.x += vel.x * dt; pos.y += vel.y * dt;
      }

      // Size: a little smaller as it climbs (further away).
      const px = (phone ? 84 : 132) * (1 - 0.22 * progress);
      const scale = (px / H) * viewH / KITE_HEIGHT;
      world(pos.x, pos.y, kite.position);
      kite.scale.setScalar(scale);
      // Leaning back into the wind and turned a little, so the bow and the paper's depth show.
      kite.rotation.set(
        -0.4 + (still ? 0 : 0.06 * Math.sin(t * 2.1)) - tug * 0.22,
        0.3 + (still ? 0 : 0.22 * Math.sin(t * 0.7)) + vel.x * 1.5,
        -vel.x * 2.2 + (still ? 0.06 : 0.09 * Math.sin(t * 1.25)),
      );

      // Bow and flutter: the edges move most.
      for (let i = 0; i < posAttr.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const edge = Math.min(1, Math.abs(x));
        const flutter = still ? 0 : 0.045 * Math.sin(t * 9 + y * 4 + x * 2) * edge + 0.02 * Math.sin(t * 13 + x * 6) * edge * edge;
        posAttr.setZ(i, -BOW * x * x + flutter * (1 + tug));
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();

      // Streamers from the bottom point; the string from the bridle to the bottom-right corner.
      kite.updateMatrixWorld();
      tail.set(bottom.x, bottom.y, 0).applyMatrix4(kite.matrixWorld);
      streamers.forEach((s, i) => {
        if (s.points[0].lengthSq() === 0) s.reset(tail);
        s.seg = 0.12 * scale * 1.4; s.width = (i ? 0.028 : 0.032) * scale * 1.4;
        side.set((i ? 0.06 : -0.06) * scale, 0, 0);
        s.step(tmp.copy(tail).add(side), 9, still ? 0 : 2.4 + Math.sin(t * 1.4 + i) * 1.6 - vel.x * 30, dt || 0.016, t);
      });
      bridle.set(0, -0.2, 0.3).applyMatrix4(kite.matrixWorld);
      world(1.04, 1.08, anchorV);
      const mid = tmp.copy(bridle).lerp(anchorV, 0.5);
      const sag = bridle.distanceTo(anchorV) * (0.16 - tug * 0.1);
      const pts = stringGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pts.count; i++) {
        const u = i / (pts.count - 1);
        // Quadratic bezier through a control point below the midpoint: the string's sag.
        const cx = mid.x, cy = mid.y - sag;
        pts.setXYZ(i, (1 - u) * (1 - u) * bridle.x + 2 * (1 - u) * u * cx + u * u * anchorV.x, (1 - u) * (1 - u) * bridle.y + 2 * (1 - u) * u * cy + u * u * anchorV.y, 0);
      }
      pts.needsUpdate = true;

      renderer.render(scene, camera);
    };

    let raf = 0;
    const loop = (now: number) => { render(now); raf = requestAnimationFrame(loop); };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) { lastFrame = performance.now(); raf = requestAnimationFrame(loop); }
    };
    const onResize = () => { resize(); if (still) render(performance.now()); };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", readScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    readScroll();
    if (still) render(performance.now()); else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", readScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        }
      });
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className="fixed inset-0 z-[35] pointer-events-none" />;
}
