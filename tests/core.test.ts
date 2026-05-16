import { describe, expect, it } from 'vitest';
import {
  createFoodPoint,
  createSeedFoodPoints,
  createSeedSourcePoints,
  createSourcePoint,
  findFoodPointAt,
  findSourcePointAt,
  moveFoodPoint,
  moveSourcePoint,
  removeFoodPoint,
  removeSourcePoint,
} from '../src/core/food';
import { getSourceFoodBlend } from '../src/core/colorField';
import { HistoryController } from '../src/core/history';
import { getParticleOpacityForAmount } from '../src/core/particleFlowSystem';
import { PhysarumSimulation } from '../src/core/physarum';
import { DEFAULT_TRAIL_GRID_SIZE, getTrailGridSize } from '../src/core/trailResolution';
import type { SerializableAppState } from '../src/types';

function baseState(): SerializableAppState {
  return {
    foodPoints: createSeedFoodPoints(),
    sourcePoints: createSeedSourcePoints(),
    sourceSettings: {
      radius: 0.42,
      strength: 1,
    },
    foodSettings: {
      radius: 0.42,
      strength: 1,
    },
    particleSettings: {
      simulationRate: 0.3,
      particleAmount: 26000,
      particleSize: 0.03,
      boundary: 10,
      turnRate: 1.55,
      sensorDistance: 4.2,
      trailDeposit: 0.34,
      trailDecay: 0.978,
      trailDiffusion: 0.22,
      randomDrift: 1.8,
    },
    material: {
      gradientStart: '#ff00ae',
      gradientEnd: '#00ff88',
      gradientContrast: 1.4,
      gradientBias: -0.5,
      gradientBlur: 0.35,
      particleVisible: true,
      trailVisible: true,
      hideSource: false,
      hideFood: false,
    },
  };
}

describe('food controls', () => {
  it('creates seeded food and source layouts', () => {
    const food = createSeedFoodPoints();
    const sources = createSeedSourcePoints();
    expect(food).toHaveLength(4);
    expect(sources).toEqual([{ id: 'source-seed-1', x: 0, z: 0 }]);
    expect(new Set(food.map((point) => point.id)).size).toBe(food.length);
    expect(food.every((point) => Number.isFinite(point.x) && Number.isFinite(point.z))).toBe(true);
  });

  it('finds and removes a food point by ground hit radius', () => {
    const points = [createFoodPoint(0, 0, 'a'), createFoodPoint(1, 0, 'b')];
    expect(findFoodPointAt(points, 0.04, 0.04, 0.1)?.id).toBe('a');
    expect(findFoodPointAt(points, 0.4, 0.4, 0.1)).toBeNull();
    expect(removeFoodPoint(points, 'a')).toEqual([points[1]]);
  });

  it('finds and removes a source point by ground hit radius', () => {
    const points = [createSourcePoint(0, 0, 'a'), createSourcePoint(1, 0, 'b')];
    expect(findSourcePointAt(points, 0.04, 0.04, 0.1)?.id).toBe('a');
    expect(findSourcePointAt(points, 0.4, 0.4, 0.1)).toBeNull();
    expect(removeSourcePoint(points, 'a')).toEqual([points[1]]);
  });

  it('moves food and source points by id', () => {
    const foodPoints = [createFoodPoint(0, 0, 'food-a'), createFoodPoint(1, 0, 'food-b')];
    const sourcePoints = [createSourcePoint(0, 0, 'source-a')];

    expect(moveFoodPoint(foodPoints, 'food-a', 0.25, -0.5)).toEqual([
      { id: 'food-a', x: 0.25, z: -0.5 },
      foodPoints[1],
    ]);
    expect(moveSourcePoint(sourcePoints, 'source-a', -0.75, 0.5)).toEqual([
      { id: 'source-a', x: -0.75, z: 0.5 },
    ]);
  });
});

describe('source food color field', () => {
  it('maps positions near sources to gradient start and near food to gradient end', () => {
    const sources = [createSourcePoint(0, 0, 'source')];
    const food = [createFoodPoint(2, 0, 'food')];

    expect(getSourceFoodBlend(0, 0, sources, food)).toBeCloseTo(0);
    expect(getSourceFoodBlend(2, 0, sources, food)).toBeCloseTo(1);
    expect(getSourceFoodBlend(1, 0, sources, food)).toBeCloseTo(0.5);
  });
});

describe('physarum trail simulation', () => {
  const particleSettings = baseState().particleSettings;

  it('scales trail grid resolution with boundary size', () => {
    expect(getTrailGridSize(6)).toBe(DEFAULT_TRAIL_GRID_SIZE);
    expect(getTrailGridSize(8)).toBe(256);
    expect(getTrailGridSize(10)).toBe(320);
    expect(getTrailGridSize(14)).toBe(448);
    expect(getTrailGridSize(20)).toBe(640);
    expect(getTrailGridSize(2)).toBe(64);
  });

  it('keeps agents finite and produces active trail cells', () => {
    const simulation = new PhysarumSimulation({
      agentCount: 600,
      gridSize: 64,
      groundSize: 6,
      seed: 12,
    });
    const sourcePoints = createSeedSourcePoints();
    const foodPoints = createSeedFoodPoints();
    const sourceSettings = { radius: 0.42, strength: 1 };
    simulation.reset(sourcePoints, sourceSettings, particleSettings);
    simulation.step(1 / 30, sourcePoints, sourceSettings, foodPoints, { radius: 0.42, strength: 1 }, particleSettings);
    const stats = simulation.getTrailStats();

    expect(stats.activeCells).toBeGreaterThan(0);
    expect(stats.averageTrail).toBeGreaterThan(0);
    expect(Number.isFinite(stats.averageTrail)).toBe(true);
  });

  it('resizes without clearing the active trail or agent positions', () => {
    const simulation = new PhysarumSimulation({
      agentCount: 600,
      gridSize: 64,
      groundSize: 6,
      seed: 12,
    });
    const sourcePoints = createSeedSourcePoints();
    const foodPoints = createSeedFoodPoints();
    const sourceSettings = { radius: 0.42, strength: 1 };
    simulation.reset(sourcePoints, sourceSettings, particleSettings);
    simulation.step(1 / 30, sourcePoints, sourceSettings, foodPoints, { radius: 0.42, strength: 1 }, particleSettings);

    const resized = simulation.resize({
      agentCount: 900,
      gridSize: 128,
      groundSize: 10,
      seed: 13,
    });
    const positions = new Float32Array(resized.agentCount * 3);
    resized.writeAgentPositions(positions);

    expect(resized.agentCount).toBe(900);
    expect(resized.gridSize).toBe(128);
    expect(resized.groundSize).toBe(10);
    expect(resized.getTrailStats().activeCells).toBeGreaterThan(0);
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  });
});

describe('history controller', () => {
  it('supports undo and redo state transitions with food points', () => {
    const first = baseState();
    const second = {
      ...baseState(),
      foodPoints: [...first.foodPoints, createFoodPoint(0.5, 0.25, 'extra')],
      sourcePoints: [...first.sourcePoints, createSourcePoint(-0.5, -0.25, 'extra-source')],
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
