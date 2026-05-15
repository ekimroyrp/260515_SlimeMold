import type { FoodPoint, FoodSettings, MaterialSettings } from '../types';

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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseHexColor(hex: string): [number, number, number] {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  const numeric = Number.parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
  if (!Number.isFinite(numeric)) {
    return [255, 255, 255];
  }
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

function wrapIndex(value: number, size: number): number {
  let next = value % size;
  if (next < 0) {
    next += size;
  }
  return next;
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

  writeAgentPositions(target: Float32Array, y = 0.035): void {
    const count = Math.min(this.agentCount, Math.floor(target.length / 3));
    for (let i = 0; i < count; i += 1) {
      const write = i * 3;
      target[write] = this.agentX[i];
      target[write + 1] = y;
      target[write + 2] = this.agentZ[i];
    }
  }

  reset(foodPoints: FoodPoint[]): void {
    this.trail.fill(0);
    const half = this.groundSize * 0.5;
    for (let i = 0; i < this.agentCount; i += 1) {
      const anchor = foodPoints.length > 0 ? foodPoints[i % foodPoints.length] : null;
      const angle = this.random() * TWO_PI;
      const radius = anchor ? 0.08 + this.random() * 0.56 : this.random() * half * 0.92;
      const centerX = anchor?.x ?? 0;
      const centerZ = anchor?.z ?? 0;
      this.agentX[i] = Math.min(half, Math.max(-half, centerX + Math.cos(angle) * radius));
      this.agentZ[i] = Math.min(half, Math.max(-half, centerZ + Math.sin(angle) * radius));
      this.agentAngle[i] = anchor ? Math.atan2(-Math.sin(angle), -Math.cos(angle)) : angle;
      this.deposit(this.agentX[i], this.agentZ[i], DEPOSIT_AMOUNT * 1.6);
    }
    this.diffuseAndDecay();
  }

  step(deltaSeconds: number, foodPoints: FoodPoint[], foodSettings: FoodSettings, speedScale: number): void {
    const dt = Math.min(1 / 20, Math.max(1 / 240, deltaSeconds));
    const substeps = Math.max(1, Math.min(4, Math.ceil(dt * 90 * Math.max(0.5, speedScale))));
    const stepDt = dt / substeps;
    for (let i = 0; i < substeps; i += 1) {
      this.stepAgents(stepDt, foodPoints, foodSettings, speedScale);
      this.diffuseAndDecay();
    }
  }

  paintToCanvas(canvas: HTMLCanvasElement, material: MaterialSettings): PhysarumStats {
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
    let activeCells = 0;
    let sum = 0;

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const read = y * this.gridSize + x;
        const raw = this.trail[read];
        const t = clamp01(raw * material.gradientContrast + material.gradientBias + 0.2);
        const glow = Math.pow(t, 0.72);
        const write = read * 4;
        image.data[write] = Math.round(4 + (start[0] + (end[0] - start[0]) * glow) * glow);
        image.data[write + 1] = Math.round(7 + (start[1] + (end[1] - start[1]) * glow) * glow);
        image.data[write + 2] = Math.round(12 + (start[2] + (end[2] - start[2]) * glow) * glow);
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

  private stepAgents(deltaSeconds: number, foodPoints: FoodPoint[], foodSettings: FoodSettings, speedScale: number): void {
    const half = this.groundSize * 0.5;
    const moveDistance = deltaSeconds * (0.32 + speedScale * 0.42);
    const turnDistance = TURN_RATE * deltaSeconds * (0.8 + speedScale * 0.15);
    const foodRadiusSq = Math.max(0.01, foodSettings.radius * foodSettings.radius);

    for (let i = 0; i < this.agentCount; i += 1) {
      let angle = this.agentAngle[i];
      const x = this.agentX[i];
      const z = this.agentZ[i];
      const forward = this.sampleSensor(x, z, angle);
      const left = this.sampleSensor(x, z, angle + SENSOR_ANGLE);
      const right = this.sampleSensor(x, z, angle - SENSOR_ANGLE);

      if (left > forward && left > right) {
        angle += turnDistance;
      } else if (right > forward && right > left) {
        angle -= turnDistance;
      } else if (forward < 0.08) {
        angle += (this.random() - 0.5) * turnDistance * 1.8;
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
      this.deposit(nextX, nextZ, DEPOSIT_AMOUNT);
    }
  }

  private sampleSensor(x: number, z: number, angle: number): number {
    const [gridX, gridY] = this.worldToGrid(
      x + Math.cos(angle) * (SENSOR_DISTANCE_CELLS / this.gridSize) * this.groundSize,
      z + Math.sin(angle) * (SENSOR_DISTANCE_CELLS / this.gridSize) * this.groundSize,
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

  private diffuseAndDecay(): void {
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
        const nextValue = (this.trail[index] + (average - this.trail[index]) * DIFFUSION_RATE) * DECAY_RATE;
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

  private worldToGrid(x: number, z: number): [number, number] {
    const half = this.groundSize * 0.5;
    const gridX = Math.max(0, Math.min(this.gridSize - 1, Math.floor(((x + half) / this.groundSize) * this.gridSize)));
    const gridY = Math.max(0, Math.min(this.gridSize - 1, Math.floor(((z + half) / this.groundSize) * this.gridSize)));
    return [gridX, gridY];
  }
}
