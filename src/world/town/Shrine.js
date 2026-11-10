import * as THREE from 'three';
import { Frame } from './Builder.js';

/**
 * EP-02 "Golden Field" — THE SHRINE
 * ============================================================================
 * Replaces the western main street with a small country shrine precinct:
 * a vermilion torii across the approach, six stone lanterns, the worship
 * hall (white plaster, dark timber, deep-eaved gable roof, shimenawa),
 * post-and-rail fencing, a water basin and a wayside hokora.
 *
 * Frame conventions (Builder.Frame maps p(x,z,y) -> world):
 *   torii:  local x = along the approach, local z = across it
 *   haiden: local x = across the approach, local z = along it (front = -z)
 * ============================================================================
 */

const WOOD = [0.58, 0.46, 0.38];
const WOOD_DARK = [0.40, 0.32, 0.27];
const VERMILION = [1.80, 0.40, 0.19];
const VERMILION_DARK = [1.42, 0.30, 0.15];
const PLASTER = [1.42, 1.38, 1.26];
const TILE = [0.66, 0.70, 0.76];
const TILE_DARK = [0.50, 0.54, 0.60];
const STONE = [0.82, 0.82, 0.78];
const STONE_MOSS = [0.70, 0.74, 0.62];
const FLAME_CORE = [3.2, 1.55, 0.55];
const PAPER = [1.55, 1.52, 1.42];

/* --------------------------------------------------------------- torii */

/** Vermilion gate. Frame: x along the approach, z across it. gy = ground. */
function torii(B, F, gy) {
  const m = 'weathered';
  const H = 4.35, halfSpan = 1.75, lean = 0.07;
  for (const s of [-1, 1]) {
    B.tube(m, F.p(0, s * halfSpan, gy - 0.25), F.p(0, s * (halfSpan - lean), gy + H),
      0.17, 0.145, 10, { col: VERMILION, caps: true, capCol: VERMILION_DARK });
    B.tube(m, F.p(0, s * halfSpan, gy - 0.20), F.p(0, s * halfSpan, gy + 0.30),
      0.19, 0.185, 10, { col: WOOD_DARK });
  }
  // nuki (tie beam) through the pillars
  B.box(m, F.sub(0, 0, gy + 3.30, 0), -0.11, 0.11, -halfSpan - 0.28, halfSpan + 0.28, -0.10, 0.10,
    { col: VERMILION, skip: '' });
  // gakuzuka (centre plaque)
  B.box(m, F.sub(0, 0, gy + 3.72, 0), -0.07, 0.07, -0.16, 0.16, -0.26, 0.26,
    { col: VERMILION_DARK, skip: '' });
  // kasagi + shimaki: flat centre span, then lifted ends
  const y0 = gy + 4.02, y1 = gy + 4.34, rise = 0.34;
  B.box(m, F.sub(0, 0, 0, 0), -0.17, 0.17, -halfSpan - 0.10, halfSpan + 0.10, y0 - 0.02, y1 - 0.02,
    { col: VERMILION, skip: '' });
  for (const s of [-1, 1]) {
    const a = F.p(0, s * (halfSpan + 0.02), y0);
    const b = F.p(0, s * (halfSpan + 0.88), y0 + rise);
    B.tube(m, a, b, 0.17, 0.155, 4, { col: VERMILION, caps: true, capCol: VERMILION_DARK });
    const a2 = F.p(0, s * (halfSpan + 0.02), y0 - 0.16);
    const b2 = F.p(0, s * (halfSpan + 0.80), y0 + rise - 0.16);
    B.tube(m, a2, b2, 0.115, 0.105, 4, { col: VERMILION_DARK, caps: true, capCol: VERMILION_DARK });
  }
}

/* ------------------------------------------------------------ lanterns */

/** One stone tōrō. Returns the fire-box anchor [x,y,z] for the lights. */
function stoneLantern(B, F, gy, rand) {
  const m = 'stone';
  const mossy = rand() < 0.22;
  const sc = mossy ? STONE_MOSS : STONE;
  const dk = [sc[0] * 0.72, sc[1] * 0.72, sc[2] * 0.72];
  B.box(m, F, -0.34, 0.34, -0.34, 0.34, gy, gy + 0.16, { col: dk, skip: '' });
  B.box(m, F, -0.22, 0.22, -0.22, 0.22, gy + 0.16, gy + 0.30, { col: sc, skip: '' });
  B.tube(m, F.p(0, 0, gy + 0.30), F.p(0, 0, gy + 1.18), 0.13, 0.10, 4, { col: sc });
  B.box(m, F, -0.26, 0.26, -0.26, 0.26, gy + 1.18, gy + 1.32, { col: sc, skip: '' });
  const yb = gy + 1.32, yt = gy + 1.62;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.box(m, F, sx * 0.135 - 0.035, sx * 0.135 + 0.035,
      sz * 0.135 - 0.035, sz * 0.135 + 0.035, yb, yt, { col: dk, skip: '' });
  }
  B.box(m, F, -0.17, 0.17, -0.17, 0.17, yb, yb + 0.045, { col: dk, skip: '' });
  B.box(m, F, -0.17, 0.17, -0.17, 0.17, yt - 0.045, yt, { col: dk, skip: '' });
  // the flame core: bright, small, mostly hidden behind the corner posts
  B.box('painted', F, -0.055, 0.055, -0.055, 0.055, yb + 0.05, yt - 0.06,
    { col: FLAME_CORE, skip: '' });
  B.box(m, F, -0.30, 0.30, -0.30, 0.30, yt, yt + 0.09, { col: sc, skip: '' });
  B.box(m, F, -0.20, 0.20, -0.20, 0.20, yt + 0.09, yt + 0.19, { col: sc, skip: '' });
  B.tube(m, F.p(0, 0, yt + 0.19), F.p(0, 0, yt + 0.34), 0.055, 0.012, 6, { col: sc, caps: true });
  return F.p(0, 0, (yb + yt) * 0.5);
}

/* --------------------------------------------------------------- haiden */

/** Worship hall. Frame: x across the approach, z along it (front at -z). */
function haiden(B, F, gy, out) {
  const W = 8.6, D = 5.6, DECK = 0.95, WALL = 2.55;
  const hw = W * 0.5, hd = D * 0.5;
  const yd = gy + DECK, yw = yd + WALL;

  /* plinth + front steps */
  B.box('stone', F, -hw - 0.5, hw + 0.5, -hd - 0.5, hd + 0.5, gy - 0.35, yd,
    { col: STONE, skip: 'b' });
  for (let i = 0; i < 3; i++) {
    const z0 = -hd - 0.5 - (3 - i) * 0.30;
    B.box('stone', F, -1.15, 1.15, z0 - 0.15, z0 + 0.15,
      gy + (DECK / 3) * i - 0.05, gy + (DECK / 3) * (i + 1), { col: STONE, skip: '' });
  }
  /* deck */
  B.box('weathered', F, -hw - 0.35, hw + 0.35, -hd - 0.35, hd + 0.35, yd - 0.10, yd,
    { col: WOOD, skip: 'b' });

  /* walls: dark timber posts + plaster infill, two door bays in front */
  for (const x of [-hw, -hw * 0.5, 0, hw * 0.5, hw]) {
    for (const z of [-hd, hd]) {
      B.box('weathered', F, x - 0.09, x + 0.09, z - 0.09, z + 0.09, yd, yw + 0.12,
        { col: WOOD_DARK, skip: '' });
    }
  }
  for (const x of [-hw, hw]) {
    for (const z of [-hd, 0, hd]) {
      B.box('weathered', F, x - 0.09, x + 0.09, z - 0.09, z + 0.09, yd, yw + 0.12,
        { col: WOOD_DARK, skip: '' });
    }
  }
  B.wallHoles('canvas', F, -hd, -hw, hw, yd + 0.05, yw, -1,
    [{ x0: -1.9, x1: -0.45, y0: yd, y1: yd + 2.05 }, { x0: 0.45, x1: 1.9, y0: yd, y1: yd + 2.05 }],
    { col: PLASTER });
  B.faceZ('canvas', F, hd, -hw, hw, yd + 0.05, yw, +1, { col: PLASTER });
  B.faceX('canvas', F, -hw, -hd, hd, yd + 0.05, yw, -1, { col: PLASTER });
  B.faceX('canvas', F, hw, -hd, hd, yd + 0.05, yw, +1, { col: PLASTER });
  // lintel + sill
  B.box('weathered', F, -hw - 0.12, hw + 0.12, -hd - 0.12, hd + 0.12, yw, yw + 0.22,
    { col: WOOD_DARK, skip: '' });
  B.box('weathered', F, -hw - 0.10, hw + 0.10, -hd - 0.10, hd + 0.10, yd, yd + 0.14,
    { col: WOOD_DARK, skip: '' });
  // dark interior behind the door bays
  B.faceZ('ash', F, -hd + 1.4, -hw, hw, yd, yw, -1, { col: [0.05, 0.04, 0.035] });

  /* roof: kirizuma gable, ridge along z, deep eaves with lifted corners */
  const oh = 1.25;
  const yEave = yw + 0.12;
  const yRidge = yw + 1.85;
  const xw = hw + oh * 0.85;
  const zw = hd + oh;
  for (const s of [-1, 1]) {
    const yMid = yEave + (yRidge - yEave) * 0.55;
    const warp = (ww) => (u, t, p) => {
      const corner = Math.pow(Math.abs(u * 2 - 1), 2.2);
      p[1] += corner * ww * 0.22;
    };
    // slope bands facing ±x (u runs along z, t runs up-slope)
    B.quad('shingle',
      F.p(s * xw, -zw, yEave), F.p(s * xw, zw, yEave),
      F.p(s * hw * 0.52, zw, yMid), F.p(s * hw * 0.52, -zw, yMid),
      { col: TILE, nu: 6, nv: 2, warp: warp(1) });
    B.quad('shingle',
      F.p(s * hw * 0.52, -zw, yMid), F.p(s * hw * 0.52, zw, yMid),
      F.p(0, zw * 0.92, yRidge), F.p(0, -zw * 0.92, yRidge),
      { col: TILE, nu: 6, nv: 2, warp: warp(0.4) });
    // dark eave underside: a NARROW band at the lip only. A full-width
    // underside reads as a second, bent roof from any low camera.
    B.quad('weathered',
      F.p(s * xw, -zw, yEave - 0.02), F.p(s * (xw - 0.42), -zw * 0.985, yEave + 0.06),
      F.p(s * (xw - 0.42), zw * 0.985, yEave + 0.06), F.p(s * xw, zw, yEave - 0.02),
      { col: WOOD_DARK, nu: 1, nv: 1 });
  }
  // gables (front + back): plaster triangle, dark inset
  for (const s of [-1, 1]) {
    B.tri('canvas',
      F.p(-hw, s * hd, yw + 0.10), F.p(hw, s * hd, yw + 0.10),
      F.p(0, s * hd, yRidge - 0.42), { col: PLASTER });
    B.tri('weathered',
      F.p(-hw * 0.45, s * hd, yw + 0.16), F.p(hw * 0.45, s * hd, yw + 0.16),
      F.p(0, s * hd, yw + 0.88), { col: WOOD_DARK });
  }
  // ridge beam with lifted ends
  B.box('shingle', F, -0.14, 0.14, -zw * 0.94, zw * 0.94, yRidge - 0.05, yRidge + 0.16,
    { col: TILE_DARK, skip: '' });
  for (const s of [-1, 1]) {
    B.box('shingle', F.sub(0, s * (zw * 0.94 - 0.14), 0, s * 0.35), -0.15, 0.15, -0.16, 0.16,
      yRidge + 0.10, yRidge + 0.30, { col: TILE_DARK, skip: '' });
  }

  /* shimenawa across the front + paper zigzags */
  const ry = yw - 0.28;
  const p0 = F.p(-hw * 0.62, -hd - 0.06, ry), p1 = F.p(hw * 0.62, -hd - 0.06, ry);
  const mid = [(p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5 - 0.16, (p0[2] + p1[2]) * 0.5 - 0.06];
  B.tube('weathered', p0, mid, 0.045, 0.040, 6, { col: [0.72, 0.62, 0.42] });
  B.tube('weathered', mid, p1, 0.040, 0.045, 6, { col: [0.72, 0.62, 0.42] });
  for (const u of [-0.30, 0.0, 0.30]) {
    B.quad('canvas',
      F.p(u * hw * 1.24 - 0.05, -hd - 0.10, ry - 0.10), F.p(u * hw * 1.24 + 0.05, -hd - 0.10, ry - 0.10),
      F.p(u * hw * 1.24 + 0.10, -hd - 0.10, ry - 0.42), F.p(u * hw * 1.24 - 0.02, -hd - 0.10, ry - 0.42),
      { col: PAPER, nu: 1, nv: 1 });
  }
  // a dim warm presence inside the door at night
  out.glow.push(F.p(0, -hd + 0.9, yd + 1.2));
}

/* ------------------------------------------------------------------ main */

export function buildShrinePrecinct(town, o) {
  const { B, street, pad, out, rand, PH } = o;
  const lampPts = [];
  const xz = (s, t) => street.xz(s, t);
  const gyAt = (s, t) => pad.height(s, t);
  const Falong = (s, t) => {                       // x along street, z across
    const c = xz(s, t);
    return new Frame(c[0], gyAt(s, t), c[1], street.dx, street.dz);
  };
  const Facross = (s, t) => {                      // x across, z along street
    const c = xz(s, t);
    /* -px/-pz: with (px,pz) the frame's local +z runs BACKWARD down the
       approach and the front door faced away from the torii. */
    return new Frame(c[0], gyAt(s, t), c[1], -street.px, -street.pz);
  };
  const collide = (F, hx, hy, hz, tag) => {
    if (!PH || !PH.addCollider) return;
    const p = F.p(0, 0, hy);
    PH.addCollider({
      shape: 'box',
      position: new THREE.Vector3(p[0], p[1], p[2]),
      halfExtents: new THREE.Vector3(hx, hy, hz),
      axis: [F.ax, F.az], mask: PH.LAYER.WORLD, tag, owner: town,
    });
  };

  /* torii across the approach */
  {
    const F = Falong(-9.5, 0);
    torii(B, F, 0);
    for (const sd of [-1, 1]) {
      const G = F.sub(0, sd * 1.75, 0);
      collide(G, 0.25, 2.3, 0.25, 'torii');
    }
  }

  /* six stone lanterns flanking the walk */
  for (const s of [-6.4, -3.2, 0.2]) {
    for (const side of [-1, 1]) {
      const F = Falong(s, side * 2.35);
      lampPts.push(stoneLantern(B, F, 0, rand));
      collide(F, 0.3, 1.0, 0.3, 'lantern');
    }
  }

  /* the hall on axis, front to the torii */
  {
    const F = Facross(5.2, 0);
    haiden(B, F, 0, out);
    collide(F, 4.9, 3.6, 3.4, 'shrine');
  }

  /* post-and-rail fence around the court */
  for (const side of [-1, 1]) {
    const t = side * 6.2;
    for (let s = -8.5; s <= 10.5; s += 1.9) {
      const c = xz(s, t), gy = gyAt(s, t);
      B.tube('weathered', [c[0], gy - 0.12, c[1]], [c[0], gy + 0.85, c[1]],
        0.055, 0.05, 6, { col: WOOD_DARK });
    }
    for (const railY of [0.42, 0.78]) {
      for (let s = -8.5; s < 10.4; s += 3.8) {
        const s1 = Math.min(s + 3.8, 10.5);
        const a = xz(s, t), b = xz(s1, t);
        B.tube('weathered', [a[0], gyAt(s, t) + railY, a[1]],
          [b[0], gyAt(s1, t) + railY, b[1]], 0.045, 0.042, 5, { col: WOOD });
      }
    }
  }

  /* tsukubai water basin */
  {
    const F = Falong(-4.6, -3.6);
    B.box('stone', F, -0.36, 0.36, -0.36, 0.36, 0, 0.42, { col: STONE_MOSS, skip: '' });
    B.box('water', F, -0.24, 0.24, -0.24, 0.24, 0.40, 0.425, { col: [0.35, 0.42, 0.46], skip: '' });
    B.tube('weathered', F.p(-0.42, 0, 0.52), F.p(0.18, 0, 0.50), 0.022, 0.020, 5,
      { col: [0.75, 0.68, 0.42] });
  }

  /* hokora: a wayside mini-shrine */
  {
    const F = Falong(1.6, 4.4);
    B.tube('weathered', F.p(0, 0, -0.1), F.p(0, 0, 1.15), 0.06, 0.055, 6, { col: WOOD_DARK });
    B.box('weathered', F, -0.34, 0.34, -0.30, 0.30, 1.15, 1.75, { col: WOOD, skip: '' });
    B.box('shingle', F, -0.44, 0.44, -0.40, 0.40, 1.75, 1.95, { col: TILE, skip: '' });
    B.box('painted', F, -0.10, 0.10, -0.31, -0.29, 1.30, 1.55, { col: VERMILION, skip: '' });
  }

  return lampPts;
}
