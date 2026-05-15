export type Vec3Tuple = [number, number, number];

export type FoodPoint = {
  id: string;
  x: number;
  z: number;
};

export type SourcePoint = {
  id: string;
  x: number;
  z: number;
};

export type FoodSettings = {
  radius: number;
  strength: number;
};

export type SourceSettings = {
  radius: number;
  strength: number;
};

export type ParticleSettings = {
  simulationRate: number;
  particleAmount: number;
  particleSize: number;
  boundary: number;
};

export type MaterialSettings = {
  gradientStart: string;
  gradientEnd: string;
  gradientContrast: number;
  gradientBias: number;
  gradientBlur: number;
  particleVisible: boolean;
  trailVisible: boolean;
  hideSource: boolean;
  hideFood: boolean;
};

export type RuntimeSettings = {
  running: boolean;
};

export type SerializableAppState = {
  foodPoints: FoodPoint[];
  sourcePoints: SourcePoint[];
  foodSettings: FoodSettings;
  sourceSettings: SourceSettings;
  particleSettings: ParticleSettings;
  material: MaterialSettings;
};
