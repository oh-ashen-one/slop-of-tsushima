import * as THREE from 'three';
import { RIVER_PTS } from '../terrain/Field.js';
import { polylineMetrics, polylineDist } from '../terrain/Noise.js';

/**
 * EP-02 "Golden Field" — THE LOG BRIDGE
 * ============================================================================
 * A weathered log-and-plank footbridge across the stream nearest the camp.
 * The deck is walkable: box colliders under the planks are what Physics
 * groundAt() stands on (see sim/Physics.js "walkable structure tops").
 * ============================================================================
 */

const RIVER_M = polylineMetrics(RIVER_PTS);

/**
 * Find the narrowest channel crossing within `searchR` metres of (nx, nz).
 * Samples the river polyline, and at each candidate measures the span
 * between banks (ground above waterLevel + 0.35) across the channel.
 */
export function findCrossing(ctx, nx, nz, searchR = 900) {
  const H = ctx.world.getHeight;
  const wsys = ctx.get ? ctx.get('water') : null;
  const surf = (x, z) => (wsys && wsys.surfaceAt ? wsys.surfaceAt(x, z) : -Infinity);
  const isWater = (x, z) => surf(x, z) > -Infinity;
  const DIRS = [[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]];
  let best = null;
  /* Radial scan from the anchor: every wet cell is a candidate; the crossing
     is the narrowest water span found in any of four directions. This finds
     pond outlets and narrows wherever they actually are, instead of trusting
     the coarse centreline polyline. */
  for (let r = 24; r <= searchR; r += 10) {
    const steps = Math.max(16, Math.round(r * 0.5));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const px = nx + Math.cos(a) * r, pz = nz + Math.sin(a) * r;
      if (!isWater(px, pz)) continue;
      for (const [dx, dz] of DIRS) {
        let bankA = null, bankB = null;
        for (let d = 0.75; d <= 26; d += 0.75) {
          if (bankA == null && !isWater(px + dx * d, pz + dz * d)) bankA = d;
          if (bankB == null && !isWater(px - dx * d, pz - dz * d)) bankB = d;
          if (bankA != null && bankB != null) break;
        }
        if (bankA == null || bankB == null) continue;
        const span = bankA + bankB;
        if (span < 5 || span > 34) continue;
        const centre = (bankA - bankB) * 0.5;
        const cx = px + dx * centre, cz = pz + dz * centre;
        const bankYA = H(px + dx * (bankA + 0.6), pz + dz * (bankA + 0.6));
        const bankYB = H(px - dx * (bankB + 0.6), pz - dz * (bankB + 0.6));
        const wsHere = surf(cx, cz);
        if (Math.min(bankYA, bankYB) < Math.max(H(cx, cz) + 0.22, wsHere + 0.30)) continue;
        const score = span * 2.2 + r * 0.35;
        if (!best || score < best.score) {
          best = {
            score, cx, cz, dx, dz, qx: dx, qz: dz, span,
            bankYA, bankYB, t: 0,
          };
        }
      }
    }
  }
  return best;
}

/** Build the bridge. Returns the deck centre for POI registration. */
export function buildLogBridge(ctx, B, site, rand) {
  const PH = ctx.get('physics');
  const H = ctx.world.getHeight;
  const wl = ctx.world.waterLevel;
  const { cx, cz, qx, qz, span } = site;

  // deck height: above both banks and well above the water
  const bedY = H(cx, cz);
  const wsys = ctx.get('water');
  const surf = (x, z) => (wsys && wsys.surfaceAt ? wsys.surfaceAt(x, z) : -Infinity);
  const wsY = Math.max(surf(cx, cz), surf(cx + qx * 3, cz + qz * 3), surf(cx - qx * 3, cz - qz * 3));
  /* The bridge grounds itself: the span reaches well past the wet edge and
     the outer ends RAMP down onto the bank, so the approach is a slope, not
     a step. endY comes from the ground AT the ends, not from the wet-edge
     samples — banks keep falling toward the water and a fixed bank height
     left the deck end hanging a metre in the air. */
  const half = span * 0.5 + 2.8;
  const axis = [qx, qz];                               // span direction
  const endY = Math.min(
    H(cx + qx * half, cz + qz * half),
    H(cx - qx * half, cz - qz * half),
  ) + 0.06;
  const deckY = Math.max(site.bankYA, site.bankYB, bedY + 1.0, wsY + 0.85, endY + 0.45) + 0.06;
  const RAMP = 3.4;
  const deckAt = (t) => {
    const sag = -0.10 * (1 - Math.pow(Math.min(Math.abs(t) / half, 1), 2));
    const edge = Math.max(0, (Math.abs(t) - (half - RAMP)) / RAMP);
    return deckY + sag - edge * (deckY - endY);
  };

  /* --- stringers: three big logs with a slight sag --- */
  const NSEG = 5;
  for (const off of [-0.52, 0, 0.52]) {
    for (let i = 0; i < NSEG; i++) {
      const t0 = -half + (2 * half * i) / NSEG;
      const t1 = -half + (2 * half * (i + 1)) / NSEG;
      const p0 = [cx + qx * t0 + (-qz) * off, deckAt(t0) - 0.16, cz + qz * t0 + qx * off];
      const p1 = [cx + qx * t1 + (-qz) * off, deckAt(t1) - 0.16, cz + qz * t1 + qx * off];
      B.tube('weathered', p0, p1, 0.115, 0.115, 7, {
        col: [0.52 + rand() * 0.10, 0.42 + rand() * 0.08, 0.34 + rand() * 0.06],
        caps: i === 0 || i === NSEG - 1, capCol: [0.62, 0.52, 0.40],
      });
    }
  }

  /* --- planks --- */
  const plankN = Math.max(6, Math.round((half * 2) / 0.30));
  for (let i = 0; i < plankN; i++) {
    const t = -half + 0.35 + ((half * 2 - 0.7) * i) / (plankN - 1);
    const yaw = (rand() - 0.5) * 0.05;
    const lift = (rand() - 0.5) * 0.012;
    const moss = rand() < 0.16;
    const col = moss ? [0.52, 0.56, 0.40] : [0.55 + rand() * 0.12, 0.44 + rand() * 0.09, 0.35 + rand() * 0.07];
    // each plank is a small box oriented across the stringers
    const px0 = cx + qx * t, pz0 = cz + qz * t;
    const ax = [-qz, qx];                              // across
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ux = ax[0] * c - ax[1] * s, uz = ax[0] * s + ax[1] * c;
    const hw = 0.62, hd = 0.115;
    const y = deckAt(t) + lift;
    const p = (lx, lz) => [
      px0 + ux * lx + qx * lz * c - qz * lz * s,
      y,
      pz0 + uz * lx + qz * lz * c + qx * lz * s,
    ];
    B.box('weathered', { p: (x2, z2, y2) => [px0 + ux * x2 + qx * z2, y + y2, pz0 + uz * x2 + qz * z2] },
      -hw, hw, -hd, hd, 0, 0.045, { col, skip: '' });
  }

  /* --- rails: posts every ~2.4 m, one sagging top rail ---
     The reference reads its bridge as STRUCTURE at 25 m; two posts at the
     third-points was a stick figure. */
  for (const side of [-1, 1]) {
    const off = side * 0.72;
    const py = [-half * 0.72, half * 0.72];
    const nPosts = Math.max(4, Math.round((half * 2) / 2.4));
    for (let i = 0; i <= nPosts; i++) {
      const t = -half * 0.86 + ((half * 1.72) * i) / nPosts;
      const px0 = cx + qx * t - qz * off, pz0 = cz + qz * t + qx * off;
      B.tube('weathered', [px0, deckAt(t) - 0.05, pz0], [px0, deckAt(t) + 0.90, pz0],
        0.05, 0.045, 6, { col: [0.48, 0.38, 0.30] });
    }
    for (const t of py) {
      const px0 = cx + qx * t - qz * off, pz0 = cz + qz * t + qx * off;
      B.tube('weathered', [px0, deckAt(t) - 0.05, pz0], [px0, deckAt(t) + 0.92, pz0],
        0.055, 0.05, 6, { col: [0.48, 0.38, 0.30] });
    }
    const mid = [
      cx - qz * off, deckAt(0) + 0.80, cz + qx * off,
    ];
    B.tube('weathered',
      [cx + qx * py[0] - qz * off, deckAt(py[0]) + 0.90, cz + qz * py[0] + qx * off],
      mid, 0.045, 0.042, 5, { col: [0.50, 0.40, 0.32] });
    B.tube('weathered', mid,
      [cx + qx * py[1] - qz * off, deckAt(py[1]) + 0.90, cz + qz * py[1] + qx * off],
      0.042, 0.045, 5, { col: [0.50, 0.40, 0.32] });
  }

  /* --- stone footings on both banks --- */
  for (const side of [-1, 1]) {
    const t = side * (half - 0.45);
    const bx = cx + qx * t, bz = cz + qz * t;
    const gy = H(bx, bz);
    B.box('rock', {
      p: (x2, z2, y2) => [bx + qx * x2 + (-qz) * z2, gy + y2, bz + qz * x2 + qx * z2],
    }, -0.85, 0.85, -0.55, 0.55, -0.30, deckAt(t) - gy - 0.02, { col: [0.62, 0.60, 0.55], skip: 'b' });
  }

  /* --- colliders: the walkable deck + the rails --- */
  if (PH && PH.addCollider) {
    /* Short slabs, each levelled at its LOWER edge: on the ramps the next
       slab's top is never more than ~0.3 m above the one underfoot, which
       keeps every step inside the controller's 0.45 m allowance. Fewer,
       longer slabs pitched against the ramp instead — their flat tops hung
       over the ramp foot and their sides shoved the player off sideways. */
    const nSlab = 12;  // ~2.3 m slabs: ramp steps stay ~0.3 m, inside the 0.42 allowance
    for (let i = 0; i < nSlab; i++) {
      const t0 = -half + (2 * half * i) / nSlab;
      const t1 = -half + (2 * half * (i + 1)) / nSlab;
      const tm = (t0 + t1) * 0.5;
      const tLow = Math.abs(t0) > Math.abs(t1) ? t0 : t1;   // edge nearer the bank
      /* Never more than 0.42 m above the ground beneath: banks dip toward
         the water UNDER the deck ends, and a slab held at ramp height above
         the dip is a 0.66 m wall, not a step. Where the deck truly is high,
         the ramp carries the ladder; where the ground dips, the slab sinks
         to meet it (the planks ride a couple of centimetres above the feet,
         invisible in play). */
      /* The deck ladder follows the RAMP. (Tracking terrain+margin instead
         sank the whole collider deck into the pond — the ground dips under
         the span and min() chose the ground every time.) The only place the
         ramp meets the ground is the ends, handled by the approach slabs. */
      PH.addCollider({
        shape: 'box',
        position: new THREE.Vector3(cx + qx * tm, deckAt(tLow) - 0.14, cz + qz * tm),
        halfExtents: new THREE.Vector3((t1 - t0) * 0.5, 0.14, 0.75),
        axis, mask: PH.LAYER.WORLD, tag: 'bridge', owner: null,
      });
    }
    /* Approach slabs: from the bank onto the deck ends. The ramp's first
       deck slab ends flush with the bank at the END POINT, but the player
       arrives from along the bank where the ground may dip — these extend
       the ladder 3 m past each end, flush with the local ground. */
    for (const side of [-1, 1]) {
      const tA = side * (half + 1.5);
      const ax2 = cx + qx * tA, az2 = cz + qz * tA;
      const topA = H(ax2, az2) + 0.08;
      PH.addCollider({
        shape: 'box',
        position: new THREE.Vector3(ax2, topA - 0.14, az2),
        halfExtents: new THREE.Vector3(1.6, 0.14, 0.85),
        axis, mask: PH.LAYER.WORLD, tag: 'bridge', owner: null,
      });
    }
    for (const side of [-1, 1]) {
      const off = side * 0.78;
      /* Rails only guard mid-deck, at mid-deck height. On the entry ramps
         the deck is a metre lower and the same box lands at HEAD height —
         the player walks up the ramp and the rail clotheslines them. */
      PH.addCollider({
        shape: 'box',
        position: new THREE.Vector3(cx - qz * off, deckAt(0) + 0.45, cz + qx * off),
        halfExtents: new THREE.Vector3(half * 0.55, 0.45, 0.06),
        axis, mask: PH.LAYER.WORLD, tag: 'bridgeRail', owner: null,
      });
    }
  }

  return { pos: new THREE.Vector3(cx, deckY, cz), axis };
}
