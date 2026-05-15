import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3,
} from 'three/webgpu';
import { getSourceFoodBlend } from './colorField';
import type { PhysarumSimulation } from './physarum';
import type { FoodPoint, MaterialSettings, SourcePoint } from '../types';

const BASE_OPACITY_AMOUNT = 26000;
const BASE_PARTICLE_OPACITY = 0.12;
const PARTICLE_Y = 0.038;

export function getParticleOpacityForAmount(amount: number): number {
  const safeAmount = Math.max(1, amount);
  const opacity = BASE_PARTICLE_OPACITY * Math.sqrt(BASE_OPACITY_AMOUNT / safeAmount);
  return Math.min(0.22, Math.max(0.035, opacity));
}

function createParticleDotTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.42)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new CanvasTexture(canvas);
}

export class ParticleFlowSystem {
  readonly object: InstancedMesh;

  private readonly amount: number;
  private readonly scene: Scene;
  private readonly positions: Float32Array;
  private readonly dotTexture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private readonly geometry: CircleGeometry;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI * 0.5);
  private readonly scale = new Vector3();
  private readonly particleColor = new Color();
  private readonly gradientStart = new Color();
  private readonly gradientEnd = new Color();
  private particleSize: number;

  constructor(scene: Scene, amount: number, particleSize: number) {
    this.scene = scene;
    this.amount = Math.max(1, Math.round(amount));
    this.positions = new Float32Array(this.amount * 3);
    this.particleSize = particleSize;

    this.geometry = new CircleGeometry(1, 12);

    this.dotTexture = createParticleDotTexture();
    this.material = new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: new Color(0xffffff),
      depthWrite: false,
      map: this.dotTexture,
      opacity: getParticleOpacityForAmount(this.amount),
      side: DoubleSide,
      transparent: true,
      vertexColors: true,
    });

    this.object = new InstancedMesh(this.geometry, this.material, this.amount);
    this.object.instanceMatrix.setUsage(DynamicDrawUsage);
    this.object.frustumCulled = false;
    this.scene.add(this.object);
  }

  get particleAmount(): number {
    return this.amount;
  }

  setSimulationRate(_value: number): void {
    // Agent movement speed is owned by PhysarumSimulation.
  }

  setParticleSize(value: number): void {
    this.particleSize = value;
    this.updateInstanceMatrices([], [], null);
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  updateFromSimulation(
    simulation: PhysarumSimulation,
    sourcePoints: SourcePoint[],
    foodPoints: FoodPoint[],
    materialSettings: MaterialSettings,
  ): void {
    simulation.writeAgentPositions(this.positions, PARTICLE_Y);
    this.updateInstanceMatrices(sourcePoints, foodPoints, materialSettings);
  }

  reset(simulation: PhysarumSimulation, sourcePoints: SourcePoint[], foodPoints: FoodPoint[], materialSettings: MaterialSettings): void {
    this.updateFromSimulation(simulation, sourcePoints, foodPoints, materialSettings);
  }

  step(_deltaSeconds: number, _simulationRate: number): void {
    // Position updates are pushed from the PhysarumSimulation each frame.
  }

  dispose(): void {
    this.scene.remove(this.object);
    this.geometry.dispose();
    this.dotTexture.dispose();
    this.material.dispose();
  }

  private updateInstanceMatrices(sourcePoints: SourcePoint[], foodPoints: FoodPoint[], materialSettings: MaterialSettings | null): void {
    this.scale.setScalar(this.particleSize);
    if (materialSettings) {
      this.gradientStart.set(materialSettings.gradientStart);
      this.gradientEnd.set(materialSettings.gradientEnd);
    }
    for (let i = 0; i < this.amount; i += 1) {
      const read = i * 3;
      const x = this.positions[read];
      const y = this.positions[read + 1];
      const z = this.positions[read + 2];
      this.position.set(x, y, z);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.object.setMatrixAt(i, this.matrix);
      if (materialSettings) {
        const blend = getSourceFoodBlend(x, z, sourcePoints, foodPoints);
        this.particleColor.copy(this.gradientStart).lerp(this.gradientEnd, blend);
        this.object.setColorAt(i, this.particleColor);
      }
    }
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) {
      this.object.instanceColor.needsUpdate = true;
    }
  }
}
