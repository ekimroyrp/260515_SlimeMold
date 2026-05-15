import type { FoodPoint, SourcePoint } from '../types';

type Point2D = FoodPoint | SourcePoint;

export type RgbColor = [number, number, number];

function nearestDistance(pointX: number, pointZ: number, points: Point2D[]): number {
  let nearestSq = Infinity;
  for (const point of points) {
    const dx = point.x - pointX;
    const dz = point.z - pointZ;
    nearestSq = Math.min(nearestSq, dx * dx + dz * dz);
  }
  return Math.sqrt(nearestSq);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getSourceFoodBlend(x: number, z: number, sourcePoints: SourcePoint[], foodPoints: FoodPoint[]): number {
  if (sourcePoints.length === 0 && foodPoints.length === 0) {
    return 0.5;
  }
  if (sourcePoints.length === 0) {
    return 1;
  }
  if (foodPoints.length === 0) {
    return 0;
  }

  const sourceDistance = nearestDistance(x, z, sourcePoints);
  const foodDistance = nearestDistance(x, z, foodPoints);
  const total = sourceDistance + foodDistance;
  if (total <= 1e-6) {
    return 0.5;
  }
  return clamp01(sourceDistance / total);
}

export function parseHexColor(hex: string): RgbColor {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  const normalized = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value;
  const numeric = Number.parseInt(normalized, 16);
  if (!Number.isFinite(numeric)) {
    return [255, 255, 255];
  }
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

export function interpolateRgb(start: RgbColor, end: RgbColor, blend: number): RgbColor {
  const t = clamp01(blend);
  return [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ];
}
