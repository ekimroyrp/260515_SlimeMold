import type { FoodPoint, SourcePoint } from '../types';

export const DEFAULT_FOOD_POINTS: FoodPoint[] = [
  { id: 'food-seed-1', x: -1.35, z: -0.85 },
  { id: 'food-seed-2', x: 1.28, z: -0.72 },
  { id: 'food-seed-3', x: 0.92, z: 1.02 },
  { id: 'food-seed-4', x: -1.12, z: 0.92 },
];

export const DEFAULT_SOURCE_POINTS: SourcePoint[] = [
  { id: 'source-seed-1', x: 0, z: 0 },
];

function clonePoints<T extends FoodPoint | SourcePoint>(points: T[]): T[] {
  return points.map((point) => ({ ...point }));
}

export function cloneFoodPoints(points: FoodPoint[]): FoodPoint[] {
  return clonePoints(points);
}

export function cloneSourcePoints(points: SourcePoint[]): SourcePoint[] {
  return clonePoints(points);
}

export function createSeedFoodPoints(): FoodPoint[] {
  return cloneFoodPoints(DEFAULT_FOOD_POINTS);
}

export function createSeedSourcePoints(): SourcePoint[] {
  return cloneSourcePoints(DEFAULT_SOURCE_POINTS);
}

export function createFoodPoint(x: number, z: number, id = `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`): FoodPoint {
  return { id, x, z };
}

export function createSourcePoint(x: number, z: number, id = `source-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`): SourcePoint {
  return { id, x, z };
}

function findPointAt<T extends FoodPoint | SourcePoint>(points: T[], x: number, z: number, radius: number): T | null {
  const radiusSq = radius * radius;
  let nearest: T | null = null;
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

export function findFoodPointAt(points: FoodPoint[], x: number, z: number, radius: number): FoodPoint | null {
  return findPointAt(points, x, z, radius);
}

export function findSourcePointAt(points: SourcePoint[], x: number, z: number, radius: number): SourcePoint | null {
  return findPointAt(points, x, z, radius);
}

export function removeFoodPoint(points: FoodPoint[], pointId: string): FoodPoint[] {
  return points.filter((point) => point.id !== pointId);
}

export function removeSourcePoint(points: SourcePoint[], pointId: string): SourcePoint[] {
  return points.filter((point) => point.id !== pointId);
}

function movePoint<T extends FoodPoint | SourcePoint>(points: T[], pointId: string, x: number, z: number): T[] {
  return points.map((point) => (point.id === pointId ? { ...point, x, z } : point));
}

export function moveFoodPoint(points: FoodPoint[], pointId: string, x: number, z: number): FoodPoint[] {
  return movePoint(points, pointId, x, z);
}

export function moveSourcePoint(points: SourcePoint[], pointId: string, x: number, z: number): SourcePoint[] {
  return movePoint(points, pointId, x, z);
}
