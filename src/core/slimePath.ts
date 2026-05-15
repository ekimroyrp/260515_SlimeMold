import type { FoodPoint, FoodSettings, SlimePathData } from '../types';

export type SlimePathOptions = {
  pointCount?: number;
  sceneRadius?: number;
};

const DEFAULT_POINT_COUNT = 16000;
const DEFAULT_SCENE_RADIUS = 2.7;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function normalize2(x: number, z: number): [number, number] {
  const length = Math.hypot(x, z);
  if (length <= 1e-8) {
    return [1, 0];
  }
  return [x / length, z / length];
}

function sortedFoodPoints(points: FoodPoint[]): FoodPoint[] {
  return [...points].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
}

export function generateSlimePath(
  foodPoints: FoodPoint[],
  foodSettings: FoodSettings,
  options: SlimePathOptions = {},
): SlimePathData {
  const pointCount = options.pointCount ?? DEFAULT_POINT_COUNT;
  const sceneRadius = options.sceneRadius ?? DEFAULT_SCENE_RADIUS;
  const positions = new Float32Array(pointCount * 3);
  const progress = new Float32Array(pointCount);
  const food = sortedFoodPoints(foodPoints);
  const strandCount = Math.max(3, food.length * 3);
  const radius = Math.max(0.08, foodSettings.radius);
  const strength = Math.max(0, foodSettings.strength);
  let maxRadius = 0;

  for (let i = 0; i < pointCount; i += 1) {
    const globalT = i / Math.max(1, pointCount - 1);
    const strand = i % strandCount;
    const strandT = (i / strandCount) / Math.max(1, Math.floor(pointCount / strandCount) - 1);
    const write = i * 3;
    let x = 0;
    let z = 0;

    if (food.length === 0) {
      const angle = globalT * Math.PI * 18 + strand * 0.9;
      const spiral = sceneRadius * (0.16 + 0.72 * strandT);
      x = Math.cos(angle) * spiral;
      z = Math.sin(angle) * spiral;
    } else if (food.length === 1) {
      const point = food[0];
      const angle = globalT * Math.PI * 34 + strand * 0.74;
      const orbit = radius * (0.35 + 1.4 * Math.sin(strandT * Math.PI) ** 2);
      x = point.x + Math.cos(angle) * orbit;
      z = point.z + Math.sin(angle) * orbit;
    } else {
      const segment = Math.floor(globalT * food.length) % food.length;
      const a = food[(segment + strand) % food.length];
      const b = food[(segment + strand + 1 + (strand % Math.max(1, food.length - 1))) % food.length];
      const localT = (globalT * food.length) % 1;
      const eased = smoothstep(localT);
      const [dirX, dirZ] = normalize2(b.x - a.x, b.z - a.z);
      const normalX = -dirZ;
      const normalZ = dirX;
      const arc = Math.sin(localT * Math.PI);
      const pulse = Math.sin(globalT * Math.PI * 44 + strand * 1.61);
      const bridgeOffset = arc * radius * (0.2 + 0.22 * strength) * pulse;
      const foodOrbit = Math.sin(globalT * Math.PI * 12 + strand) * radius * 0.16;

      x = lerp(a.x, b.x, eased) + normalX * bridgeOffset + dirX * foodOrbit;
      z = lerp(a.z, b.z, eased) + normalZ * bridgeOffset + dirZ * foodOrbit;
    }

    positions[write] = x;
    positions[write + 1] = 0;
    positions[write + 2] = z;
    progress[i] = globalT;
    maxRadius = Math.max(maxRadius, Math.hypot(x, z));
  }

  return {
    positions,
    progress,
    pointCount,
    boundsRadius: Math.max(sceneRadius, maxRadius),
  };
}
