import type { FoodPoint } from '../types';

export const DEFAULT_FOOD_POINTS: FoodPoint[] = [
  { id: 'food-seed-1', x: -1.35, z: -0.85 },
  { id: 'food-seed-2', x: 1.28, z: -0.72 },
  { id: 'food-seed-3', x: 0.92, z: 1.02 },
  { id: 'food-seed-4', x: -1.12, z: 0.92 },
];

export function cloneFoodPoints(points: FoodPoint[]): FoodPoint[] {
  return points.map((point) => ({ ...point }));
}

export function createSeedFoodPoints(): FoodPoint[] {
  return cloneFoodPoints(DEFAULT_FOOD_POINTS);
}

export function createFoodPoint(x: number, z: number, id = `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`): FoodPoint {
  return { id, x, z };
}

export function findFoodPointAt(points: FoodPoint[], x: number, z: number, radius: number): FoodPoint | null {
  const radiusSq = radius * radius;
  let nearest: FoodPoint | null = null;
  let nearestSq = Infinity;

  for (const point of points) {
    const dx = point.x - x;
    const dz = point.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq <= radiusSq && distanceSq < nearestSq) {
      nearest = point;
      nearestSq = distanceSq;
    }
  }

  return nearest;
}

export function removeFoodPoint(points: FoodPoint[], pointId: string): FoodPoint[] {
  return points.filter((point) => point.id !== pointId);
}
