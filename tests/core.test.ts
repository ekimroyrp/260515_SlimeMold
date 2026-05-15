import { describe, expect, it } from 'vitest';
import { createFoodPoint, createSeedFoodPoints, findFoodPointAt, removeFoodPoint } from '../src/core/food';
import { HistoryController } from '../src/core/history';
import { getParticleOpacityForAmount } from '../src/core/particleFlowSystem';
import { PhysarumSimulation } from '../src/core/physarum';
import type { SerializableAppState } from '../src/types';

function baseState(): SerializableAppState {
  return {
    foodPoints: createSeedFoodPoints(),
    foodSettings: {
      radius: 0.42,
      strength: 1,
    },
    particleSettings: {
      simulationRate: 0.3,
      particleAmount: 26000,
      particleSize: 0.03,
      particleSpread: 0.1,
    },
    material: {
      gradientStart: '#b19eff',
      gradientEnd: '#ffae00',
      gradientContrast: 1.4,
      gradientBias: -0.4,
      gradientBlur: 0.35,
      trailVisible: true,
    },
  };
}

describe('food controls', () => {
  it('creates a seeded starter layout', () => {
    const points = createSeedFoodPoints();
    expect(points).toHaveLength(4);
    expect(new Set(points.map((point) => point.id)).size).toBe(points.length);
    expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.z))).toBe(true);
  });

  it('finds and removes a food point by ground hit radius', () => {
    const points = [createFoodPoint(0, 0, 'a'), createFoodPoint(1, 0, 'b')];
    expect(findFoodPointAt(points, 0.04, 0.04, 0.1)?.id).toBe('a');
    expect(findFoodPointAt(points, 0.4, 0.4, 0.1)).toBeNull();
    expect(removeFoodPoint(points, 'a')).toEqual([points[1]]);
  });
});

describe('physarum trail simulation', () => {
  it('keeps agents finite and produces active trail cells', () => {
    const simulation = new PhysarumSimulation({
      agentCount: 600,
      gridSize: 64,
      groundSize: 6,
      seed: 12,
    });
    const foodPoints = createSeedFoodPoints();
    simulation.reset(foodPoints);
    simulation.step(1 / 30, foodPoints, { radius: 0.42, strength: 1 }, 0.3);
    const stats = simulation.getTrailStats();

    expect(stats.activeCells).toBeGreaterThan(0);
    expect(stats.averageTrail).toBeGreaterThan(0);
    expect(Number.isFinite(stats.averageTrail)).toBe(true);
  });
});

describe('history controller', () => {
  it('supports undo and redo state transitions with food points', () => {
    const first = baseState();
    const second = {
      ...baseState(),
      foodPoints: [...first.foodPoints, createFoodPoint(0.5, 0.25, 'extra')],
    };
    const history = new HistoryController(first);

    history.commit(second);
    expect(history.undoCount).toBe(1);
    expect(history.redoCount).toBe(0);
    expect(history.undo()).toEqual(first);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(1);
    expect(history.redo()).toEqual(second);
  });

  it('ignores duplicate commits', () => {
    const state = baseState();
    const history = new HistoryController(state);
    history.commit(state);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });
});

describe('particle display tuning', () => {
  it('reduces additive opacity as particle counts rise', () => {
    const low = getParticleOpacityForAmount(1000);
    const defaultAmount = getParticleOpacityForAmount(26000);
    const high = getParticleOpacityForAmount(80000);

    expect(low).toBeGreaterThan(defaultAmount);
    expect(defaultAmount).toBeGreaterThan(high);
    expect(high).toBeGreaterThanOrEqual(0.035);
    expect(low).toBeLessThanOrEqual(0.22);
  });
});
