import './style.css';
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  cloneFoodPoints,
  cloneSourcePoints,
  createFoodPoint,
  createSeedFoodPoints,
  createSeedSourcePoints,
  createSourcePoint,
  findFoodPointAt,
  findSourcePointAt,
  removeFoodPoint,
  removeSourcePoint,
} from './core/food';
import { parseHexColor } from './core/colorField';
import { HistoryController } from './core/history';
import { ParticleFlowSystem } from './core/particleFlowSystem';
import { PhysarumSimulation } from './core/physarum';
import type {
  FoodPoint,
  FoodSettings,
  MaterialSettings,
  ParticleSettings,
  RuntimeSettings,
  SerializableAppState,
  SourcePoint,
  SourceSettings,
} from './types';

type UiRefs = {
  panel: HTMLDivElement;
  handleTop: HTMLDivElement;
  handleBottom: HTMLDivElement;
  collapseToggle: HTMLButtonElement;
  webgpuWarning: HTMLDivElement;
  start: HTMLButtonElement;
  reset: HTMLButtonElement;
  simulationRate: HTMLInputElement;
  simulationRateValue: HTMLSpanElement;
  particleBoundary: HTMLInputElement;
  particleBoundaryValue: HTMLSpanElement;
  particleAmount: HTMLInputElement;
  particleAmountValue: HTMLSpanElement;
  particleSize: HTMLInputElement;
  particleSizeValue: HTMLSpanElement;
  runtimeStats: HTMLDivElement;
  sourceRadius: HTMLInputElement;
  sourceRadiusValue: HTMLSpanElement;
  sourceStrength: HTMLInputElement;
  sourceStrengthValue: HTMLSpanElement;
  sourceStats: HTMLDivElement;
  resetSource: HTMLButtonElement;
  hideSource: HTMLInputElement;
  foodRadius: HTMLInputElement;
  foodRadiusValue: HTMLSpanElement;
  foodStrength: HTMLInputElement;
  foodStrengthValue: HTMLSpanElement;
  foodStats: HTMLDivElement;
  resetFood: HTMLButtonElement;
  hideFood: HTMLInputElement;
  gradientStart: HTMLInputElement;
  gradientEnd: HTMLInputElement;
  gradientContrast: HTMLInputElement;
  gradientContrastValue: HTMLSpanElement;
  gradientBias: HTMLInputElement;
  gradientBiasValue: HTMLSpanElement;
  gradientBlur: HTMLInputElement;
  gradientBlurValue: HTMLSpanElement;
  particleVisible: HTMLInputElement;
  trailVisible: HTMLInputElement;
  exportScreenshot: HTMLButtonElement;
};

const EXPORT_BASE_NAME = '260515_SlimeMold';
const DEFAULT_BOUNDARY_SIZE = 6;
const FOOD_HIT_MIN_RADIUS = 0.13;
const PHYSARUM_GRID_SIZE = 192;

function revealUiWhenStyled(maxWaitMs = 1500): void {
  const start = performance.now();
  const tryReveal = (): void => {
    const styled = getComputedStyle(document.documentElement).getPropertyValue('--ui-size-scale').trim().length > 0;
    if (styled || performance.now() - start >= maxWaitMs) {
      document.documentElement.classList.add('ui-ready');
      return;
    }
    requestAnimationFrame(tryReveal);
  };
  tryReveal();
}

function requiredElement<T extends Element>(id: string, check: (element: Element) => element is T): T {
  const element = document.getElementById(id);
  if (!element || !check(element)) {
    throw new Error(`Required element #${id} was not found or has an unexpected type.`);
  }
  return element;
}

function isInput(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

function isButton(element: Element): element is HTMLButtonElement {
  return element instanceof HTMLButtonElement;
}

function isDiv(element: Element): element is HTMLDivElement {
  return element instanceof HTMLDivElement;
}

function isSpan(element: Element): element is HTMLSpanElement {
  return element instanceof HTMLSpanElement;
}

function updateRangeProgress(input: HTMLInputElement): void {
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
    input.style.setProperty('--range-progress', '0%');
    return;
  }
  const progress = ((value - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${Math.min(100, Math.max(0, progress))}%`);
}

function stepDecimals(stepValue: string): number {
  if (!stepValue || stepValue === 'any') {
    return 6;
  }
  const decimal = stepValue.split('.')[1];
  return decimal ? decimal.length : 0;
}

function clampAndSnapInputValue(input: HTMLInputElement, value: number): number {
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  const step = Number.parseFloat(input.step);
  let next = value;
  if (Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    next = base + Math.round((next - base) / step) * step;
  }
  if (Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  return next;
}

function setRangeValue(input: HTMLInputElement, valueLabel: HTMLSpanElement, value: number, format: (value: number) => string): void {
  const snapped = clampAndSnapInputValue(input, value);
  input.value = snapped.toFixed(stepDecimals(input.step));
  valueLabel.textContent = format(snapped);
  updateRangeProgress(input);
}

function bindRange(
  input: HTMLInputElement,
  valueLabel: HTMLSpanElement,
  format: (value: number) => string,
  onInput: (value: number) => void,
  onCommit: () => void,
): void {
  const commitManualValue = (rawValue: string): void => {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      setRangeValue(input, valueLabel, Number.parseFloat(input.value), format);
      return;
    }
    const next = clampAndSnapInputValue(input, parsed);
    input.value = next.toFixed(stepDecimals(input.step));
    setRangeValue(input, valueLabel, next, format);
    onInput(next);
    onCommit();
  };

  let isManualEditing = false;
  const beginManualEdit = (): void => {
    if (isManualEditing) {
      return;
    }
    isManualEditing = true;

    const editor = document.createElement('input');
    editor.type = 'number';
    editor.className = 'value-editor';
    editor.value = input.value;
    editor.min = input.min;
    editor.max = input.max;
    editor.step = input.step;
    valueLabel.replaceWith(editor);
    editor.focus();
    editor.select();

    let finalized = false;
    const finish = (commit: boolean): void => {
      if (finalized) {
        return;
      }
      finalized = true;
      const submitted = editor.value;
      editor.replaceWith(valueLabel);
      isManualEditing = false;
      if (commit) {
        commitManualValue(submitted);
      } else {
        setRangeValue(input, valueLabel, Number.parseFloat(input.value), format);
      }
    };

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    editor.addEventListener('blur', () => {
      finish(true);
    });
  };

  valueLabel.addEventListener('click', (event) => {
    event.stopPropagation();
    beginManualEdit();
  });

  input.addEventListener('input', () => {
    const value = Number.parseFloat(input.value);
    valueLabel.textContent = format(value);
    updateRangeProgress(input);
    onInput(value);
  });
  input.addEventListener('change', onCommit);
  setRangeValue(input, valueLabel, Number.parseFloat(input.value), format);
}

function formatFixed(decimals: number): (value: number) => string {
  return (value: number) => value.toFixed(decimals);
}

function formatInteger(value: number): string {
  return `${Math.round(value)}`;
}

function formatStatsNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function showWarning(ui: UiRefs, message: string): void {
  ui.webgpuWarning.textContent = message;
  ui.webgpuWarning.hidden = false;
}

const ui: UiRefs = {
  panel: requiredElement('ui-panel', isDiv),
  handleTop: requiredElement('ui-handle', isDiv),
  handleBottom: requiredElement('ui-handle-bottom', isDiv),
  collapseToggle: requiredElement('collapse-toggle', isButton),
  webgpuWarning: requiredElement('webgpu-warning', isDiv),
  start: requiredElement('start-sim', isButton),
  reset: requiredElement('reset-sim', isButton),
  simulationRate: requiredElement('simulation-rate', isInput),
  simulationRateValue: requiredElement('simulation-rate-value', isSpan),
  particleBoundary: requiredElement('particle-boundary', isInput),
  particleBoundaryValue: requiredElement('particle-boundary-value', isSpan),
  particleAmount: requiredElement('particle-amount', isInput),
  particleAmountValue: requiredElement('particle-amount-value', isSpan),
  particleSize: requiredElement('particle-size', isInput),
  particleSizeValue: requiredElement('particle-size-value', isSpan),
  runtimeStats: requiredElement('runtime-stats', isDiv),
  sourceRadius: requiredElement('source-radius', isInput),
  sourceRadiusValue: requiredElement('source-radius-value', isSpan),
  sourceStrength: requiredElement('source-strength', isInput),
  sourceStrengthValue: requiredElement('source-strength-value', isSpan),
  sourceStats: requiredElement('source-stats', isDiv),
  resetSource: requiredElement('reset-source', isButton),
  hideSource: requiredElement('hide-source', isInput),
  foodRadius: requiredElement('food-radius', isInput),
  foodRadiusValue: requiredElement('food-radius-value', isSpan),
  foodStrength: requiredElement('food-strength', isInput),
  foodStrengthValue: requiredElement('food-strength-value', isSpan),
  foodStats: requiredElement('food-stats', isDiv),
  resetFood: requiredElement('reset-food', isButton),
  hideFood: requiredElement('hide-food', isInput),
  gradientStart: requiredElement('gradient-start-color', isInput),
  gradientEnd: requiredElement('gradient-end-color', isInput),
  gradientContrast: requiredElement('gradient-contrast', isInput),
  gradientContrastValue: requiredElement('gradient-contrast-value', isSpan),
  gradientBias: requiredElement('gradient-bias', isInput),
  gradientBiasValue: requiredElement('gradient-bias-value', isSpan),
  gradientBlur: requiredElement('gradient-blur', isInput),
  gradientBlurValue: requiredElement('gradient-blur-value', isSpan),
  particleVisible: requiredElement('particle-visible', isInput),
  trailVisible: requiredElement('trail-visible', isInput),
  exportScreenshot: requiredElement('export-screenshot', isButton),
};

const queriedCanvas = document.querySelector<HTMLCanvasElement>('#app-canvas');
if (!queriedCanvas) {
  throw new Error('Required canvas #app-canvas was not found.');
}
const appCanvas: HTMLCanvasElement = queriedCanvas;

revealUiWhenStyled();

let foodPoints: FoodPoint[] = createSeedFoodPoints();
let sourcePoints: SourcePoint[] = createSeedSourcePoints();
const foodSettings: FoodSettings = {
  radius: Number.parseFloat(ui.foodRadius.value),
  strength: Number.parseFloat(ui.foodStrength.value),
};
const sourceSettings: SourceSettings = {
  radius: Number.parseFloat(ui.sourceRadius.value),
  strength: Number.parseFloat(ui.sourceStrength.value),
};
const particleSettings: ParticleSettings = {
  simulationRate: Number.parseFloat(ui.simulationRate.value),
  particleAmount: Number.parseInt(ui.particleAmount.value, 10),
  particleSize: Number.parseFloat(ui.particleSize.value),
  boundary: Number.parseFloat(ui.particleBoundary.value),
};
const materialSettings: MaterialSettings = {
  gradientStart: ui.gradientStart.value,
  gradientEnd: ui.gradientEnd.value,
  gradientContrast: Number.parseFloat(ui.gradientContrast.value),
  gradientBias: Number.parseFloat(ui.gradientBias.value),
  gradientBlur: Number.parseFloat(ui.gradientBlur.value),
  particleVisible: ui.particleVisible.checked,
  trailVisible: ui.trailVisible.checked,
  hideSource: ui.hideSource.checked,
  hideFood: ui.hideFood.checked,
};
const runtimeSettings: RuntimeSettings = {
  running: false,
};

let history: HistoryController;
let particleSystem: ParticleFlowSystem | null = null;
let renderer: WebGPURenderer;
let scene: Scene;
let camera: PerspectiveCamera;
let controls: OrbitControls;
let foodGroup: Group;
let trailPlane: Mesh<PlaneGeometry, MeshBasicMaterial>;
let trailTexture: CanvasTexture;
let trailSimulation: PhysarumSimulation | null = null;
let draggingPanel = false;
let particlesCleared = false;
const dragOffset = { x: 0, y: 0 };
const raycaster = new Raycaster();
const pointerNdc = new Vector2();
const groundPoint = new Vector3();
let screenshotExportCount = 0;

function getBoundarySize(): number {
  return Math.max(2, particleSettings.boundary || DEFAULT_BOUNDARY_SIZE);
}

function createPhysarumSimulation(): PhysarumSimulation {
  return new PhysarumSimulation({
    agentCount: particleSettings.particleAmount,
    gridSize: PHYSARUM_GRID_SIZE,
    groundSize: getBoundarySize(),
  });
}

function clampPointsToBoundary(): void {
  const half = getBoundarySize() * 0.5;
  const clampPoint = (point: FoodPoint | SourcePoint): void => {
    point.x = Math.min(half, Math.max(-half, point.x));
    point.z = Math.min(half, Math.max(-half, point.z));
  };
  foodPoints.forEach(clampPoint);
  sourcePoints.forEach(clampPoint);
}

function getSerializableState(): SerializableAppState {
  return {
    foodPoints: cloneFoodPoints(foodPoints),
    sourcePoints: cloneSourcePoints(sourcePoints),
    foodSettings: { ...foodSettings },
    sourceSettings: { ...sourceSettings },
    particleSettings: { ...particleSettings },
    material: { ...materialSettings },
  };
}

function setStartButtonState(running: boolean): void {
  ui.start.textContent = running ? 'Pause' : 'Start';
  ui.start.classList.toggle('is-stop-state', running);
  ui.start.classList.toggle('is-start-state', !running);
}

function stopSimulation(): void {
  runtimeSettings.running = false;
  setStartButtonState(false);
}

function clearParticlesUntilStart(): void {
  particlesCleared = true;
  particleSystem?.setVisible(false);
}

function syncParticleVisibility(): void {
  particleSystem?.setVisible(materialSettings.particleVisible && !particlesCleared);
}

function showParticlesForStart(): void {
  if (!particlesCleared) {
    return;
  }
  particlesCleared = false;
  syncParticleVisibility();
  if (trailSimulation) {
    particleSystem?.reset(trailSimulation, sourcePoints, foodPoints, materialSettings);
  }
}

function updateStats(fps = 0): void {
  const trailStats = trailSimulation?.getTrailStats();
  const activeCells = trailStats ? ` | Map ${formatStatsNumber(trailStats.activeCells)}` : '';
  ui.runtimeStats.textContent = `WebGPU | FPS ${Math.round(fps)} | Particles ${formatStatsNumber(particleSettings.particleAmount)}${activeCells}`;
  ui.sourceStats.textContent = `Sources ${sourcePoints.length}`;
  ui.foodStats.textContent = `Food ${foodPoints.length}`;
}

function nextScreenshotName(): string {
  screenshotExportCount += 1;
  const serial = String(screenshotExportCount).padStart(3, '0');
  return `${EXPORT_BASE_NAME}_${serial}.png`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportScreenshot(): void {
  renderer.render(scene, camera);
  appCanvas.toBlob((blob) => {
    if (!blob) {
      return;
    }

    downloadBlob(blob, nextScreenshotName());
  }, 'image/png');
}

function worldToTrailTexture(x: number, z: number): [number, number] {
  const boundary = getBoundarySize();
  const half = boundary * 0.5;
  return [
    ((x + half) / boundary) * PHYSARUM_GRID_SIZE,
    ((z + half) / boundary) * PHYSARUM_GRID_SIZE,
  ];
}

function rgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = parseHexColor(hex).map((channel) => Math.round(channel));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawPointGlows(context: CanvasRenderingContext2D, points: Array<FoodPoint | SourcePoint>, radiusSetting: number, color: string): void {
  for (const point of points) {
    const [x, y] = worldToTrailTexture(point.x, point.z);
    const radius = Math.max(9, radiusSetting * 28);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgbaFromHex(color, 0.78));
    glow.addColorStop(0.34, rgbaFromHex(color, 0.28));
    glow.addColorStop(1, rgbaFromHex(color, 0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function redrawTrailTexture(): void {
  const canvas = trailTexture.image as HTMLCanvasElement;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  trailSimulation?.paintToCanvas(canvas, materialSettings, sourcePoints, foodPoints);
  if (!materialSettings.hideSource) {
    drawPointGlows(context, sourcePoints, sourceSettings.radius, materialSettings.gradientStart);
  }
  if (!materialSettings.hideFood) {
    drawPointGlows(context, foodPoints, foodSettings.radius, materialSettings.gradientEnd);
  }
  trailTexture.needsUpdate = true;
}

function rebuildFoodMeshes(): void {
  foodGroup.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
  foodGroup.clear();
  const foodRadius = Math.max(0.055, Math.min(0.18, foodSettings.radius * 0.28));
  const sourceRadius = Math.max(0.05, Math.min(0.16, sourceSettings.radius * 0.24));
  const addPointMesh = (point: FoodPoint | SourcePoint, radius: number, color: string, kind: string): void => {
    const geometry = new CircleGeometry(radius, 32);
    const outlineGeometry = new RingGeometry(radius * 1.04, radius * 1.22, 32);
    const material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(point.x, 0.018, point.z);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.userData.pointId = point.id;
    mesh.userData.pointKind = kind;
    foodGroup.add(mesh);

    const outline = new Mesh(
      outlineGeometry,
      new MeshBasicMaterial({
        color: new Color(0xffffff),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    outline.position.set(point.x, 0.021, point.z);
    outline.rotation.x = -Math.PI * 0.5;
    outline.userData.pointId = point.id;
    outline.userData.pointKind = kind;
    foodGroup.add(outline);
  };

  if (!materialSettings.hideSource) {
    for (const point of sourcePoints) {
      addPointMesh(point, sourceRadius, materialSettings.gradientStart, 'source');
    }
  }
  if (!materialSettings.hideFood) {
    for (const point of foodPoints) {
      addPointMesh(point, foodRadius, materialSettings.gradientEnd, 'food');
    }
  }
}

function rebuildParticleSystem(): void {
  if (!scene || !trailSimulation) {
    return;
  }
  particleSystem?.dispose();
  particleSystem = new ParticleFlowSystem(scene, trailSimulation.agentCount, particleSettings.particleSize);
  particleSystem.setSimulationRate(particleSettings.simulationRate);
  particleSystem.updateFromSimulation(trailSimulation, sourcePoints, foodPoints, materialSettings);
  syncParticleVisibility();
}

function updateTrailPlaneGeometry(): void {
  if (!trailPlane) {
    return;
  }
  trailPlane.geometry.dispose();
  trailPlane.geometry = new PlaneGeometry(getBoundarySize(), getBoundarySize());
}

function rebuildSimulationBoundary(): void {
  const wasRunning = runtimeSettings.running;
  stopSimulation();
  clampPointsToBoundary();
  trailSimulation = createPhysarumSimulation();
  trailSimulation.reset(sourcePoints, sourceSettings);
  updateTrailPlaneGeometry();
  redrawTrailTexture();
  rebuildFoodMeshes();
  rebuildParticleSystem();
  runtimeSettings.running = wasRunning;
  setStartButtonState(wasRunning);
  updateStats();
}

function rebuildSlimeField(resetTrail = true): void {
  if (resetTrail) {
    trailSimulation?.reset(sourcePoints, sourceSettings);
  }

  if (trailPlane) {
    trailPlane.visible = materialSettings.trailVisible;
    redrawTrailTexture();
  }

  if (foodGroup) {
    rebuildFoodMeshes();
  }

  if (!particleSystem) {
    rebuildParticleSystem();
  } else if (trailSimulation) {
    particleSystem.updateFromSimulation(trailSimulation, sourcePoints, foodPoints, materialSettings);
  }
  if (!runtimeSettings.running && !particlesCleared) {
    trailSimulation?.step(1 / 60, sourcePoints, sourceSettings, foodPoints, foodSettings, 0.5);
    if (trailSimulation) {
      particleSystem?.updateFromSimulation(trailSimulation, sourcePoints, foodPoints, materialSettings);
    }
  }
  updateStats();
}

function commitHistoryIfChanged(): void {
  history.commit(getSerializableState());
  updateStats();
}

function syncStaticControlsFromState(): void {
  setRangeValue(ui.simulationRate, ui.simulationRateValue, particleSettings.simulationRate, formatFixed(2));
  setRangeValue(ui.particleBoundary, ui.particleBoundaryValue, particleSettings.boundary, formatFixed(1));
  setRangeValue(ui.particleAmount, ui.particleAmountValue, particleSettings.particleAmount, formatInteger);
  setRangeValue(ui.particleSize, ui.particleSizeValue, particleSettings.particleSize, formatFixed(3));
  setRangeValue(ui.sourceRadius, ui.sourceRadiusValue, sourceSettings.radius, formatFixed(2));
  setRangeValue(ui.sourceStrength, ui.sourceStrengthValue, sourceSettings.strength, formatFixed(2));
  setRangeValue(ui.foodRadius, ui.foodRadiusValue, foodSettings.radius, formatFixed(2));
  setRangeValue(ui.foodStrength, ui.foodStrengthValue, foodSettings.strength, formatFixed(2));
  setRangeValue(ui.gradientContrast, ui.gradientContrastValue, materialSettings.gradientContrast, formatFixed(2));
  setRangeValue(ui.gradientBias, ui.gradientBiasValue, materialSettings.gradientBias, formatFixed(2));
  setRangeValue(ui.gradientBlur, ui.gradientBlurValue, materialSettings.gradientBlur, formatFixed(2));
  ui.gradientStart.value = materialSettings.gradientStart;
  ui.gradientEnd.value = materialSettings.gradientEnd;
  ui.particleVisible.checked = materialSettings.particleVisible;
  ui.trailVisible.checked = materialSettings.trailVisible;
  ui.hideSource.checked = materialSettings.hideSource;
  ui.hideFood.checked = materialSettings.hideFood;
}

function applySerializableState(state: SerializableAppState): void {
  foodPoints = cloneFoodPoints(state.foodPoints);
  sourcePoints = cloneSourcePoints(state.sourcePoints);
  foodSettings.radius = state.foodSettings.radius;
  foodSettings.strength = state.foodSettings.strength;
  sourceSettings.radius = state.sourceSettings.radius;
  sourceSettings.strength = state.sourceSettings.strength;
  particleSettings.simulationRate = state.particleSettings.simulationRate;
  particleSettings.particleAmount = state.particleSettings.particleAmount;
  particleSettings.particleSize = state.particleSettings.particleSize;
  particleSettings.boundary = state.particleSettings.boundary;
  materialSettings.gradientStart = state.material.gradientStart;
  materialSettings.gradientEnd = state.material.gradientEnd;
  materialSettings.gradientContrast = state.material.gradientContrast;
  materialSettings.gradientBias = state.material.gradientBias;
  materialSettings.gradientBlur = state.material.gradientBlur;
  materialSettings.particleVisible = state.material.particleVisible;
  materialSettings.trailVisible = state.material.trailVisible;
  materialSettings.hideSource = state.material.hideSource;
  materialSettings.hideFood = state.material.hideFood;
  syncStaticControlsFromState();
  rebuildSimulationBoundary();
}

function bindSectionCollapseToggles(): void {
  const headers = ui.panel.querySelectorAll<HTMLDivElement>('.panel-section-header');
  headers.forEach((header) => {
    const section = header.closest('.panel-section');
    if (!section) {
      return;
    }

    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', section.classList.contains('is-collapsed') ? 'false' : 'true');

    const toggle = (): void => {
      const collapsed = section.classList.toggle('is-collapsed');
      header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });
}

function clampPanelToViewport(): void {
  if (window.innerWidth <= 700) {
    ui.panel.style.left = '';
    ui.panel.style.top = '';
    return;
  }

  const panelRect = ui.panel.getBoundingClientRect();
  const width = panelRect.width;
  const height = panelRect.height;
  const maxLeft = Math.max(12, window.innerWidth - width - 12);
  const maxTop = Math.max(12, window.innerHeight - height - 12);
  ui.panel.style.left = `${Math.min(maxLeft, Math.max(12, panelRect.left))}px`;
  ui.panel.style.top = `${Math.min(maxTop, Math.max(12, panelRect.top))}px`;
  ui.panel.style.right = 'auto';
  ui.panel.style.bottom = 'auto';
}

function bindPanelDrag(): void {
  const beginPanelDrag = (event: PointerEvent): void => {
    if (event.target instanceof Element && event.target.closest('.collapse-button')) {
      return;
    }
    draggingPanel = true;
    const rect = ui.panel.getBoundingClientRect();
    ui.panel.style.left = `${rect.left}px`;
    ui.panel.style.top = `${rect.top}px`;
    ui.panel.style.right = 'auto';
    ui.panel.style.bottom = 'auto';
    dragOffset.x = event.clientX - rect.left;
    dragOffset.y = event.clientY - rect.top;
  };

  ui.handleTop.addEventListener('pointerdown', beginPanelDrag);
  ui.handleBottom.addEventListener('pointerdown', beginPanelDrag);
  window.addEventListener('pointermove', (event) => {
    if (!draggingPanel) {
      return;
    }
    ui.panel.style.left = `${event.clientX - dragOffset.x}px`;
    ui.panel.style.top = `${event.clientY - dragOffset.y}px`;
    clampPanelToViewport();
  });
  window.addEventListener('pointerup', () => {
    draggingPanel = false;
  });
  window.addEventListener('pointercancel', () => {
    draggingPanel = false;
  });
}

function bindStaticControls(): void {
  bindRange(
    ui.simulationRate,
    ui.simulationRateValue,
    formatFixed(2),
    (value) => {
      particleSettings.simulationRate = value;
      particleSystem?.setSimulationRate(value);
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.particleBoundary,
    ui.particleBoundaryValue,
    formatFixed(1),
    (value) => {
      particleSettings.boundary = value;
      rebuildSimulationBoundary();
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.particleAmount,
    ui.particleAmountValue,
    formatInteger,
    (value) => {
      particleSettings.particleAmount = Math.round(value);
      updateStats();
    },
    () => {
      const wasRunning = runtimeSettings.running;
      stopSimulation();
      trailSimulation = createPhysarumSimulation();
      trailSimulation.reset(sourcePoints, sourceSettings);
      redrawTrailTexture();
      rebuildParticleSystem();
      runtimeSettings.running = wasRunning;
      setStartButtonState(wasRunning);
      commitHistoryIfChanged();
    },
  );
  bindRange(
    ui.particleSize,
    ui.particleSizeValue,
    formatFixed(3),
    (value) => {
      particleSettings.particleSize = value;
      particleSystem?.setParticleSize(value);
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.sourceRadius,
    ui.sourceRadiusValue,
    formatFixed(2),
    (value) => {
      sourceSettings.radius = value;
      rebuildSlimeField();
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.sourceStrength,
    ui.sourceStrengthValue,
    formatFixed(2),
    (value) => {
      sourceSettings.strength = value;
      rebuildSlimeField();
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.foodRadius,
    ui.foodRadiusValue,
    formatFixed(2),
    (value) => {
      foodSettings.radius = value;
      rebuildSlimeField();
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.foodStrength,
    ui.foodStrengthValue,
    formatFixed(2),
    (value) => {
      foodSettings.strength = value;
      rebuildSlimeField();
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.gradientContrast,
    ui.gradientContrastValue,
    formatFixed(2),
    (value) => {
      materialSettings.gradientContrast = value;
      rebuildSlimeField(false);
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.gradientBias,
    ui.gradientBiasValue,
    formatFixed(2),
    (value) => {
      materialSettings.gradientBias = value;
      rebuildSlimeField(false);
    },
    commitHistoryIfChanged,
  );
  bindRange(
    ui.gradientBlur,
    ui.gradientBlurValue,
    formatFixed(2),
    (value) => {
      materialSettings.gradientBlur = value;
      rebuildSlimeField(false);
    },
    commitHistoryIfChanged,
  );

  ui.gradientStart.addEventListener('input', () => {
    materialSettings.gradientStart = ui.gradientStart.value;
    rebuildSlimeField(false);
  });
  ui.gradientStart.addEventListener('change', commitHistoryIfChanged);
  ui.gradientEnd.addEventListener('input', () => {
    materialSettings.gradientEnd = ui.gradientEnd.value;
    rebuildSlimeField(false);
  });
  ui.gradientEnd.addEventListener('change', commitHistoryIfChanged);
  ui.particleVisible.addEventListener('change', () => {
    materialSettings.particleVisible = ui.particleVisible.checked;
    syncParticleVisibility();
    commitHistoryIfChanged();
  });
  ui.trailVisible.addEventListener('change', () => {
    materialSettings.trailVisible = ui.trailVisible.checked;
    trailPlane.visible = materialSettings.trailVisible;
    commitHistoryIfChanged();
  });
  ui.hideSource.addEventListener('change', () => {
    materialSettings.hideSource = ui.hideSource.checked;
    rebuildFoodMeshes();
    redrawTrailTexture();
    commitHistoryIfChanged();
  });
  ui.hideFood.addEventListener('change', () => {
    materialSettings.hideFood = ui.hideFood.checked;
    rebuildFoodMeshes();
    redrawTrailTexture();
    commitHistoryIfChanged();
  });

  ui.start.addEventListener('click', () => {
    const shouldRun = !runtimeSettings.running;
    if (shouldRun) {
      showParticlesForStart();
    }
    runtimeSettings.running = shouldRun;
    setStartButtonState(runtimeSettings.running);
  });
  ui.reset.addEventListener('click', () => {
    stopSimulation();
    trailSimulation?.reset(sourcePoints, sourceSettings);
    if (trailSimulation) {
      particleSystem?.reset(trailSimulation, sourcePoints, foodPoints, materialSettings);
    }
    redrawTrailTexture();
    clearParticlesUntilStart();
  });
  ui.resetSource.addEventListener('click', () => {
    sourcePoints = createSeedSourcePoints();
    rebuildSlimeField();
    commitHistoryIfChanged();
  });
  ui.resetFood.addEventListener('click', () => {
    foodPoints = createSeedFoodPoints();
    rebuildSlimeField();
    commitHistoryIfChanged();
  });
  ui.exportScreenshot.addEventListener('click', exportScreenshot);
  ui.collapseToggle.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  ui.collapseToggle.addEventListener('click', () => {
    const collapsed = ui.panel.classList.toggle('is-collapsed');
    ui.collapseToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
}

function bindHistoryShortcuts(): void {
  window.addEventListener('keydown', (event) => {
    if (document.activeElement instanceof HTMLInputElement && document.activeElement.classList.contains('value-editor')) {
      return;
    }
    const key = event.key.toLowerCase();
    const undoRequested = event.ctrlKey && key === 'z' && !event.shiftKey;
    const redoRequested = event.ctrlKey && (key === 'y' || (key === 'z' && event.shiftKey));
    if (!undoRequested && !redoRequested) {
      return;
    }
    event.preventDefault();
    const state = undoRequested ? history.undo() : history.redo();
    if (state) {
      applySerializableState(state);
    }
  });
}

function getCanvasGroundPoint(event: MouseEvent): Vector3 | null {
  const rect = appCanvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const directionY = raycaster.ray.direction.y;
  if (Math.abs(directionY) < 1e-6) {
    return null;
  }
  const t = -raycaster.ray.origin.y / directionY;
  if (t < 0) {
    return null;
  }
  groundPoint.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, t);
  return groundPoint;
}

function addFoodAt(point: Vector3): void {
  const half = getBoundarySize() * 0.5;
  const x = Math.min(half, Math.max(-half, point.x));
  const z = Math.min(half, Math.max(-half, point.z));
  foodPoints = [...foodPoints, createFoodPoint(x, z)];
  rebuildSlimeField();
  commitHistoryIfChanged();
}

function addSourceAt(point: Vector3): void {
  const half = getBoundarySize() * 0.5;
  const x = Math.min(half, Math.max(-half, point.x));
  const z = Math.min(half, Math.max(-half, point.z));
  sourcePoints = [...sourcePoints, createSourcePoint(x, z)];
  rebuildSlimeField();
  commitHistoryIfChanged();
}

function squaredDistance(point: FoodPoint | SourcePoint, x: number, z: number): number {
  const dx = point.x - x;
  const dz = point.z - z;
  return dx * dx + dz * dz;
}

function deleteEditablePointAt(point: Vector3): void {
  const sourceHitRadius = Math.max(FOOD_HIT_MIN_RADIUS, sourceSettings.radius * 0.42);
  const foodHitRadius = Math.max(FOOD_HIT_MIN_RADIUS, foodSettings.radius * 0.42);
  const sourceHit = findSourcePointAt(sourcePoints, point.x, point.z, sourceHitRadius);
  const foodHit = findFoodPointAt(foodPoints, point.x, point.z, foodHitRadius);
  if (!sourceHit && !foodHit) {
    return;
  }
  if (sourceHit && (!foodHit || squaredDistance(sourceHit, point.x, point.z) <= squaredDistance(foodHit, point.x, point.z))) {
    sourcePoints = removeSourcePoint(sourcePoints, sourceHit.id);
  } else if (foodHit) {
    foodPoints = removeFoodPoint(foodPoints, foodHit.id);
  }
  rebuildSlimeField();
  commitHistoryIfChanged();
}

function bindFoodCanvasEditing(): void {
  appCanvas.addEventListener('click', (event) => {
    if (event.button !== 0 || event.detail !== 1) {
      return;
    }
    event.preventDefault();
    const point = getCanvasGroundPoint(event)?.clone();
    if (!point) {
      return;
    }
    if (event.ctrlKey) {
      deleteEditablePointAt(point);
    } else if (event.shiftKey) {
      addSourceAt(point);
    } else {
      addFoodAt(point);
    }
  });
}

function handleResize(camera: PerspectiveCamera): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.5, 3));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  clampPanelToViewport();
}

function createTrailTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = PHYSARUM_GRID_SIZE;
  canvas.height = PHYSARUM_GRID_SIZE;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function initApp(): Promise<void> {
  if (!('gpu' in navigator)) {
    showWarning(ui, 'WebGPU is required for this project. Open it in a current Chromium-based browser with WebGPU enabled.');
    return;
  }

  scene = new Scene();
  scene.background = new Color(0x030407);

  camera = new PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 4.8, 4.9);
  camera.lookAt(0, 0, 0);

  renderer = new WebGPURenderer({ antialias: true, canvas: appCanvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.5, 3));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  await renderer.init();

  const backend = renderer.backend as { isWebGPUBackend?: boolean };
  if (!backend.isWebGPUBackend) {
    throw new Error('Strict WebGPU mode is required, but Three.js initialized a fallback backend.');
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.target.set(0, 0, 0);
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.mouseButtons = {
    LEFT: -1 as unknown as MOUSE,
    MIDDLE: MOUSE.PAN,
    RIGHT: MOUSE.ROTATE,
  };
  controls.update();

  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  trailTexture = createTrailTexture();
  trailSimulation = createPhysarumSimulation();
  trailSimulation.reset(sourcePoints, sourceSettings);
  const trailMaterial = new MeshBasicMaterial({
    map: trailTexture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: DoubleSide,
  });
  trailPlane = new Mesh(new PlaneGeometry(getBoundarySize(), getBoundarySize()), trailMaterial);
  trailPlane.rotation.x = -Math.PI * 0.5;
  trailPlane.position.y = -0.012;
  trailPlane.visible = materialSettings.trailVisible;
  scene.add(trailPlane);

  foodGroup = new Group();
  scene.add(foodGroup);

  history = new HistoryController(getSerializableState());
  bindSectionCollapseToggles();
  bindPanelDrag();
  bindStaticControls();
  bindHistoryShortcuts();
  bindFoodCanvasEditing();
  syncStaticControlsFromState();
  rebuildFoodMeshes();
  redrawTrailTexture();
  rebuildParticleSystem();
  setStartButtonState(false);
  updateStats();
  renderer.render(scene, camera);

  window.addEventListener('resize', () => handleResize(camera));
  handleResize(camera);

  let lastTime = performance.now();
  let fpsAccumulator = 0;
  let fpsFrames = 0;
  let fpsValue = 0;

  renderer.setAnimationLoop((now) => {
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    controls.update();

    if (runtimeSettings.running) {
      trailSimulation?.step(delta, sourcePoints, sourceSettings, foodPoints, foodSettings, particleSettings.simulationRate);
      if (trailSimulation) {
        particleSystem?.updateFromSimulation(trailSimulation, sourcePoints, foodPoints, materialSettings);
      }
      redrawTrailTexture();
    }

    fpsAccumulator += delta;
    fpsFrames += 1;
    if (fpsAccumulator >= 0.25) {
      fpsValue = fpsFrames / fpsAccumulator;
      fpsAccumulator = 0;
      fpsFrames = 0;
      updateStats(fpsValue);
    }

    renderer.render(scene, camera);
  });
}

void initApp().catch((error: unknown) => {
  console.error(error);
  showWarning(ui, error instanceof Error ? error.message : 'Unable to initialize the WebGPU slime mold simulation.');
});
