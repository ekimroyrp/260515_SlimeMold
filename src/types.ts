export type Vec3Tuple = [number, number, number];

export type FoodPoint = {
  id: string;
  x: number;
  z: number;
};

export type FoodSettings = {
  radius: number;
  strength: number;
};

export type ParticleSettings = {
  simulationRate: number;
  particleAmount: number;
  particleSize: number;
  particleSpread: number;
};

export type MaterialSettings = {
  gradientStart: string;
  gradientEnd: string;
  gradientContrast: number;
  gradientBias: number;
  gradientBlur: number;
  trailVisible: boolean;
};

export type RuntimeSettings = {
  running: boolean;
};

export type SerializableAppState = {
  foodPoints: FoodPoint[];
  foodSettings: FoodSettings;
  particleSettings: ParticleSettings;
  material: MaterialSettings;
};
