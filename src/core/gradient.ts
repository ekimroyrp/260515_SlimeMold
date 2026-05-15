import { Color } from 'three/webgpu';
import type { MaterialSettings } from '../types';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function blurValues(values: Float32Array, strength: number): Float32Array {
  const blurred = Float32Array.from(values);
  if (blurred.length <= 2 || strength <= 0) {
    return blurred;
  }

  const passes = Math.max(1, Math.round(strength * 6));
  const amount = Math.min(0.55, strength * 0.55);
  const temp = new Float32Array(blurred.length);
  for (let pass = 0; pass < passes; pass += 1) {
    temp[0] = blurred[0];
    temp[blurred.length - 1] = blurred[blurred.length - 1];
    for (let i = 1; i < blurred.length - 1; i += 1) {
      const average = (blurred[i - 1] + blurred[i] + blurred[i + 1]) / 3;
      temp[i] = blurred[i] + (average - blurred[i]) * amount;
    }
    blurred.set(temp);
  }
  return blurred;
}

export function buildGradientColors(progress: Float32Array, settings: MaterialSettings): Float32Array {
  const colors = new Float32Array(progress.length * 3);
  const start = new Color(settings.gradientStart);
  const end = new Color(settings.gradientEnd);
  const blurred = blurValues(progress, settings.gradientBlur);

  for (let i = 0; i < blurred.length; i += 1) {
    const t = clamp01(blurred[i] * settings.gradientContrast + settings.gradientBias);
    const write = i * 3;
    colors[write] = start.r + (end.r - start.r) * t;
    colors[write + 1] = start.g + (end.g - start.g) * t;
    colors[write + 2] = start.b + (end.b - start.b) * t;
  }

  return colors;
}
