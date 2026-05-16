import { clamp01, getSourceFoodBlend, interpolateRgb, parseHexColor } from './colorField';
import type { FoodPoint, FoodSettings, MaterialSettings, ParticleSettings, SourcePoint, SourceSettings } from '../types';

export type PhysarumOptions = {
  agentCount: number;
  gridSize: number;
  groundSize: number;
  seed?: number;
};

export type PhysarumStats = {
  activeCells: number;
  averageTrail: number;
};

const TWO_PI = Math.PI * 2;
const SENSOR_DISTANCE_CELLS = 4.2;
const SENSOR_ANGLE = 0.72;
const TURN_RATE = 1.55;
const DEPOSIT_AMOUNT = 0.34;
const DIFFUSION_RATE = 0.22;
const DECAY_RATE = 0.978;
const RANDOM_DRIFT = 1.8;

type BehaviorSettings = Pick<
  ParticleSettings,
  'simulationRate' | 'turnRate' | 'sensorDistance' | 'trailDeposit' | 'trailDecay' | 'trailDiffusion' | 'randomDrift'
>;

const DEFAULT_BEHAVIOR: BehaviorSettings = {
  simulationRate: 0.3,
  turnRate: TURN_RATE,
  sensorDistance: SENSOR_DISTANCE_CELLS,
  trailDeposit: DEPOSIT_AMOUNT,
  trailDecay: DECAY_RATE,
  trailDiffusion: DIFFUSION_RATE,
  randomDrift: RANDOM_DRIFT,
};

function resolveBehavior(settings?: BehaviorSettings): BehaviorSettings {
  if (!settings) {
    return DEFAULT_BEHAVIOR;
  }
  return {
    simulationRate: settings.simulationRate,
    turnRate: settings.turnRate,
    sensorDistance: settings.sensorDistance,
    trailDeposit: settings.trailDeposit,
    trailDecay: settings.trailDecay,
    trailDiffusion: settings.trailDiffusion,
    randomDrift: settings.randomDrift,
  };
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapIndex(value: number, size: number): number {
  let next = value % size;
  if (next < 0) {
    next += size;
  }
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class PhysarumSimulation {
  readonly agentCount: number;
  readonly gridSize: number;
  readonly groundSize: number;

  private readonly agentX: Float32Array;
  private readonly agentZ: Float32Array;
  private readonly agentAngle: Float32Array;
  private readonly trail: Float32Array;
  private readonly nextTrail: Float32Array;
  private readonly random: () => number;
  private emissionCursor = 0;
  private stats: PhysarumStats = { activeCells: 0, averageTrail: 0 };

  constructor(options: PhysarumOptions) {
    this.agentCount = Math.max(1, Math.round(options.agentCount));
    this.gridSize = Math.max(32, Math.round(options.gridSize));
    this.groundSize = options.groundSize;
    this.agentX = new Float32Array(this.agentCount);
    this.agentZ = new Float32Array(this.agentCount);
    this.agentAngle = new Float32Array(this.agentCount);
    this.trail = new Float32Array(this.gridSize * this.gridSize);
    this.nextTrail = new Float32Array(this.trail.length);
    this.random = createRandom(options.seed ?? 260515);
  }

  getTrailStats(): PhysarumStats {
    return { ...this.stats };
  }

  resize(options: PhysarumOptions): PhysarumSimulation {
    const next = new PhysarumSimulation(options);
    this.copyAgentsTo(next);
    this.copyTrailTo(next);
    next.emissionCursor = this.emissionCursor % next.agentCount;
    next.updateStatsFromTrail();
    return next;
  }

  writeAgentPositions(target: Float32Array, y = 0.035): void {
    const count = Math.min(this.agentCount, Math.floor(target.length / 3));
    for (let i = 0; i < count; i += 1) {
      const write = i * 3;
      target[write] = this.agentX[i];
      target[write + 1] = y;
      target[write + 2] = this.agentZ[i];
    }
  }

  reset(sourcePoints: SourcePoint[], sourceSettings: SourceSettings, particleSettings?: BehaviorSettings): void {
    const behavior = resolveBehavior(particleSettings);
    this.trail.fill(0);
    for (let i = 0; i < this.agentCount; i += 1) {
      const anchor = sourcePoints.length > 0 ? sourcePoints[i % sourcePoints.length] : null;
      this.placeAgentAtSource(i, anchor, sourceSettings);
      this.deposit(this.agentX[i], this.agentZ[i], behavior.trailDeposit * Math.max(0.2, sourceSettings.strength) * 1.6);
    }
    this.emissionCursor = 0;
    this.diffuseAndDecay(behavior);
  }

  step(
    deltaSeconds: number,
    sourcePoints: SourcePoint[],
    sourceSettings: SourceSettings,
    foodPoints: FoodPoint[],
    foodSettings: FoodSettings,
    particleSettings: BehaviorSettings,
  ): void {
    const behavior = resolveBehavior(particleSettings);
    const speedScale = behavior.simulationRate;
    const dt = Math.min(1 / 20, Math.max(1 / 240, deltaSeconds));
    const substeps = Math.max(1, Math.min(4, Math.ceil(dt * 90 * Math.max(0.5, speedScale))));
    const stepDt = dt / substeps;
    for (let i = 0; i < substeps; i += 1) {
      this.emitFromSources(stepDt, sourcePoints, sourceSettings, behavior);
      this.stepAgents(stepDt, foodPoints, foodSettings, behavior);
      this.diffuseAndDecay(behavior);
    }
  }

  paintToCanvas(canvas: HTMLCanvasElement, material: MaterialSettings, sourcePoints: SourcePoint[], foodPoints: FoodPoint[]): PhysarumStats {
    if (canvas.width !== this.gridSize || canvas.height !== this.gridSize) {
      canvas.width = this.gridSize;
      canvas.height = this.gridSize;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return this.stats;
    }

    const image = context.createImageData(this.gridSize, this.gridSize);
    const start = parseHexColor(material.gradientStart);
    const end = parseHexColor(material.gradientEnd);
    const half = this.groundSize * 0.5;
    let activeCells = 0;
    let sum = 0;

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const read = y * this.gridSize + x;
        const raw = this.trail[read];
        const t = clamp01(raw * material.gradientContrast + material.gradientBias + 0.2);
        const glow = Math.pow(t, 0.72);
        const worldX = (x / Math.max(1, this.gridSize - 1)) * this.groundSize - half;
        const worldZ = (y / Math.max(1, this.gridSize - 1)) * this.groundSize - half;
        const blend = getSourceFoodBlend(worldX, worldZ, sourcePoints, foodPoints);
        const color = interpolateRgb(start, end, blend);
        const write = read * 4;
        image.data[write] = Math.round(4 + color[0] * glow);
        image.data[write + 1] = Math.round(7 + color[1] * glow);
        image.data[write + 2] = Math.round(12 + color[2] * glow);
        image.data[write + 3] = 255;
        if (raw > 0.05) {
          activeCells += 1;
        }
        sum += raw;
      }
    }

    context.putImageData(image, 0, 0);
    this.stats = {
      activeCells,
      averageTrail: sum / this.trail.length,
    };
    return this.getTrailStats();
  }

  private placeAgentAtSource(index: number, source: SourcePoint | null, sourceSettings: SourceSettings): void {
    const half = this.groundSize * 0.5;
    const angle = this.random() * TWO_PI;
    const radius = source
      ? Math.max(0.01, sourceSettings.radius) * (0.12 + this.random() * 0.72)
      : this.random() * half * 0.16;
    const centerX = source?.x ?? 0;
    const centerZ = source?.z ?? 0;
    this.agentX[index] = Math.min(half, Math.max(-half, centerX + Math.cos(angle) * radius));
    this.agentZ[index] = Math.min(half, Math.max(-half, centerZ + Math.sin(angle) * radius));
    this.agentAngle[index] = angle;
  }

  private copyAgentsTo(target: PhysarumSimulation): void {
    const half = target.groundSize * 0.5;
    const jitterScale = Math.max(0.002, target.groundSize / target.gridSize);
    for (let i = 0; i < target.agentCount; i += 1) {
      const sourceIndex = i % this.agentCount;
      const isNewAgent = i >= this.agentCount;
      const angle = this.agentAngle[sourceIndex] + (isNewAgent ? (target.random() - 0.5) * 0.42 : 0);
      const jitter = isNewAgent ? jitterScale * (0.5 + target.random()) : 0;
      target.agentX[i] = clamp(this.agentX[sourceIndex] + Math.cos(angle) * jitter, -half, half);
      target.agentZ[i] = clamp(this.agentZ[sourceIndex] + Math.sin(angle) * jitter, -half, half);
      target.agentAngle[i] = angle;
    }
  }

  private copyTrailTo(target: PhysarumSimulation): void {
    const half = target.groundSize * 0.5;
    for (let y = 0; y < target.gridSize; y += 1) {
      const worldZ = ((y + 0.5) / target.gridSize) * target.groundSize - half;
      for (let x = 0; x < target.gridSize; x += 1) {
        const worldX = ((x + 0.5) / target.gridSize) * target.groundSize - half;
        target.trail[y * target.gridSize + x] = this.sampleTrailAtWorld(worldX, worldZ);
      }
    }
  }

  private sampleTrailAtWorld(x: number, z: number): number {
    const half = this.groundSize * 0.5;
    const gridX = ((x + half) / this.groundSize) * this.gridSize - 0.5;
    const gridY = ((z + half) / this.groundSize) * this.gridSize - 0.5;
    if (gridX < 0 || gridY < 0 || gridX > this.gridSize - 1 || gridY > this.gridSize - 1) {
      return 0;
    }

    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const x1 = Math.min(this.gridSize - 1, x0 + 1);
    const y1 = Math.min(this.gridSize - 1, y0 + 1);
    const tx = gridX - x0;
    const ty = gridY - y0;
    const top = this.trail[y0 * this.gridSize + x0] * (1 - tx) + this.trail[y0 * this.gridSize + x1] * tx;
    const bottom = this.trail[y1 * this.gridSize + x0] * (1 - tx) + this.trail[y1 * this.gridSize + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  }

  private emitFromSources(
    deltaSeconds: number,
    sourcePoints: SourcePoint[],
    sourceSettings: SourceSettings,
    behavior: BehaviorSettings,
  ): void {
    if (sourcePoints.length === 0 || sourceSettings.strength <= 0) {
      return;
    }
    const emitCount = Math.min(this.agentCount, Math.max(1, Math.round(this.agentCount * deltaSeconds * 0.018 * sourceSettings.strength)));
    for (let i = 0; i < emitCount; i += 1) {
      const agentIndex = this.emissionCursor % this.agentCount;
      const source = sourcePoints[this.emissionCursor % sourcePoints.length];
      this.placeAgentAtSource(agentIndex, source, sourceSettings);
      this.deposit(this.agentX[agentIndex], this.agentZ[agentIndex], behavior.trailDeposit * sourceSettings.strength);
      this.emissionCursor += 1;
    }
  }

  private stepAgents(deltaSeconds: number, foodPoints: FoodPoint[], foodSettings: FoodSettings, behavior: BehaviorSettings): void {
    const half = this.groundSize * 0.5;
    const speedScale = behavior.simulationRate;
    const moveDistance = deltaSeconds * (0.32 + speedScale * 0.42);
    const turnDistance = behavior.turnRate * deltaSeconds * (0.8 + speedScale * 0.15);
    const foodRadiusSq = Math.max(0.01, foodSettings.radius * foodSettings.radius);

    for (let i = 0; i < this.agentCount; i += 1) {
      let angle = this.agentAngle[i];
      const x = this.agentX[i];
      const z = this.agentZ[i];
      const forward = this.sampleSensor(x, z, angle, behavior.sensorDistance);
      const left = this.sampleSensor(x, z, angle + SENSOR_ANGLE, behavior.sensorDistance);
      const right = this.sampleSensor(x, z, angle - SENSOR_ANGLE, behavior.sensorDistance);

      if (left > forward && left > right) {
        angle += turnDistance;
      } else if (right > forward && right > left) {
        angle -= turnDistance;
      } else if (forward < 0.08) {
        angle += (this.random() - 0.5) * turnDistance * behavior.randomDrift;
      }

      if (foodPoints.length > 0 && foodSettings.strength > 0) {
        let foodX = 0;
        let foodZ = 0;
        let foodWeight = 0;
        for (const food of foodPoints) {
          const dx = food.x - x;
          const dz = food.z - z;
          const distanceSq = dx * dx + dz * dz;
          const influence = foodSettings.strength / (1 + distanceSq / foodRadiusSq);
          foodX += dx * influence;
          foodZ += dz * influence;
          foodWeight += influence;
        }
        if (foodWeight > 0.0001) {
          const targetAngle = Math.atan2(foodZ / foodWeight, foodX / foodWeight);
          let deltaAngle = targetAngle - angle;
          while (deltaAngle > Math.PI) {
            deltaAngle -= TWO_PI;
          }
          while (deltaAngle < -Math.PI) {
            deltaAngle += TWO_PI;
          }
          angle += Math.max(-turnDistance, Math.min(turnDistance, deltaAngle)) * 0.82;
        }
      }

      let nextX = x + Math.cos(angle) * moveDistance;
      let nextZ = z + Math.sin(angle) * moveDistance;
      if (nextX < -half || nextX > half || nextZ < -half || nextZ > half) {
        nextX = Math.min(half, Math.max(-half, nextX));
        nextZ = Math.min(half, Math.max(-half, nextZ));
        angle += Math.PI * (0.72 + this.random() * 0.56);
      }

      this.agentX[i] = nextX;
      this.agentZ[i] = nextZ;
      this.agentAngle[i] = angle;
      this.deposit(nextX, nextZ, behavior.trailDeposit);
    }
  }

  private sampleSensor(x: number, z: number, angle: number, sensorDistance = SENSOR_DISTANCE_CELLS): number {
    const [gridX, gridY] = this.worldToGrid(
      x + Math.cos(angle) * (sensorDistance / this.gridSize) * this.groundSize,
      z + Math.sin(angle) * (sensorDistance / this.gridSize) * this.groundSize,
    );
    let sum = 0;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        sum += this.trail[wrapIndex(gridY + oy, this.gridSize) * this.gridSize + wrapIndex(gridX + ox, this.gridSize)];
      }
    }
    return sum / 9;
  }

  private deposit(x: number, z: number, amount: number): void {
    const [gridX, gridY] = this.worldToGrid(x, z);
    const index = gridY * this.gridSize + gridX;
    this.trail[index] = Math.min(1, this.trail[index] + amount);
  }

  private diffuseAndDecay(behavior: BehaviorSettings = DEFAULT_BEHAVIOR): void {
    let activeCells = 0;
    let sum = 0;
    for (let y = 0; y < this.gridSize; y += 1) {
      const up = wrapIndex(y - 1, this.gridSize) * this.gridSize;
      const row = y * this.gridSize;
      const down = wrapIndex(y + 1, this.gridSize) * this.gridSize;
      for (let x = 0; x < this.gridSize; x += 1) {
        const left = wrapIndex(x - 1, this.gridSize);
        const right = wrapIndex(x + 1, this.gridSize);
        const index = row + x;
        const average = (
          this.trail[up + left] +
          this.trail[up + x] +
          this.trail[up + right] +
          this.trail[row + left] +
          this.trail[index] +
          this.trail[row + right] +
          this.trail[down + left] +
          this.trail[down + x] +
          this.trail[down + right]
        ) / 9;
        const nextValue = (
          this.trail[index] +
          (average - this.trail[index]) * behavior.trailDiffusion
        ) * behavior.trailDecay;
        this.nextTrail[index] = nextValue;
        if (nextValue > 0.05) {
          activeCells += 1;
        }
        sum += nextValue;
      }
    }
    this.trail.set(this.nextTrail);
    this.stats = {
      activeCells,
      averageTrail: sum / this.trail.length,
    };
  }

  private updateStatsFromTrail(): void {
    let activeCells = 0;
    let sum = 0;
    for (let i = 0; i < this.trail.length; i += 1) {
      const value = this.trail[i];
      if (value > 0.05) {
        activeCells += 1;
      }
      sum += value;
    }
    this.stats = {
      activeCells,
      averageTrail: sum / this.trail.length,
    };
  }

  private worldToGrid(x: number, z: number): [number, number] {
    const half = this.groundSize * 0.5;
    const gridX = Math.max(0, Math.min(this.gridSize - 1, Math.floor(((x + half) / this.groundSize) * this.gridSize)));
    const gridY = Math.max(0, Math.min(this.gridSize - 1, Math.floor(((z + half) / this.groundSize) * this.gridSize)));
    return [gridX, gridY];
  }
}
