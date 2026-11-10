/**
 * Quality presets + global tunables.
 * FROZEN CONTRACT — systems read from `ctx.quality`. Do not rename fields.
 */

export const PRESETS = {
  low: {
    name: 'low',
    pixelRatio: 1,
    shadowCascades: 2,
    shadowMapSize: 1024,
    shadowDistance: 220,
    softShadows: false,
    ssao: false,
    ssr: false,
    volumetrics: false,
    volumetricSteps: 0,
    taa: false,
    motionBlur: false,
    dof: false,
    bloom: true,
    grassDensity: 0.22,
    grassDistance: 55,
    treeDistance: 900,
    terrainLodBias: 1.6,
    cloudSteps: 0,
    waterQuality: 0,
    particleBudget: 1500,
    anisotropy: 4,
  },
  medium: {
    name: 'medium',
    pixelRatio: 1,
    shadowCascades: 3,
    shadowMapSize: 1536,
    shadowDistance: 380,
    softShadows: true,
    ssao: true,
    ssr: false,
    volumetrics: true,
    volumetricSteps: 24,
    taa: true,
    motionBlur: false,
    dof: false,
    bloom: true,
    grassDensity: 0.55,
    grassDistance: 90,
    treeDistance: 1400,
    terrainLodBias: 1.15,
    cloudSteps: 48,
    waterQuality: 1,
    particleBudget: 5000,
    anisotropy: 8,
  },
  high: {
    name: 'high',
    pixelRatio: 1,
    shadowCascades: 4,
    shadowMapSize: 2048,
    shadowDistance: 620,
    softShadows: true,
    ssao: true,
    /* EP-02: ssr was ~3 ms of the forest overage and the pond keeps its own
       reflection path. Off at ultra; ssao stays (it grounds the world). */
    ssr: false,
    volumetrics: true,
    volumetricSteps: 48,
    taa: true,
    motionBlur: true,
    dof: false,
    bloom: true,
    grassDensity: 1.0,
    grassDistance: 135,
    treeDistance: 2200,
    terrainLodBias: 1.0,
    cloudSteps: 96,
    waterQuality: 2,
    particleBudget: 12000,
    anisotropy: 8,
  },
  ultra: {
    name: 'ultra',
    /* EP-02: the golden-field content is fill-bound at any ratio above 1.0
       (measured: 8.1 ms at 0.6, 22.7 ms at 1.15, same frame). The 16 ms
       budget was set at native 1080p; honour it at native 1080p. */
    pixelRatio: 1.0,
    shadowCascades: 4,
    shadowMapSize: 2560,
    shadowDistance: 900,
    softShadows: true,
    ssao: true,
    /* EP-02: ssr was ~3 ms of the forest overage and the pond keeps its own
       reflection path. Off at ultra; ssao stays (it grounds the world). */
    ssr: false,
    volumetrics: true,
    volumetricSteps: 48,
    taa: true,
    motionBlur: true,
    dof: false,
    bloom: true,
    grassDensity: 1.5,
    grassDistance: 190,
    treeDistance: 2200,
    terrainLodBias: 1.1,
    cloudSteps: 96,
    waterQuality: 2,
    particleBudget: 24000,
    anisotropy: 8,
  },
};

/** World-scale constants. 1 unit = 1 metre. */
export const WORLD = {
  /** Terrain extent in metres (square, centred on origin). */
  size: 8192,
  /** Heightfield resolution used for simulation/erosion. */
  heightRes: 1024,
  /** Max terrain altitude in metres. */
  maxAltitude: 620,
  /** Sea / river base level in metres. */
  waterLevel: 18,
  /** Latitude used by the solar model, degrees. */
  latitude: 34.5,
};

export function detectPreset() {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced && PRESETS[forced]) return PRESETS[forced];
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (mem >= 8 && cores >= 8) return PRESETS.high;
  if (mem >= 4 && cores >= 4) return PRESETS.medium;
  return PRESETS.low;
}
