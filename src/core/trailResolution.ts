export const DEFAULT_BOUNDARY_SIZE = 10;
export const DEFAULT_TRAIL_GRID_SIZE = 192;

const TRAIL_REFERENCE_BOUNDARY_SIZE = 6;
const TRAIL_CELLS_PER_WORLD_UNIT = DEFAULT_TRAIL_GRID_SIZE / TRAIL_REFERENCE_BOUNDARY_SIZE;
const MIN_TRAIL_GRID_SIZE = 64;
const MAX_TRAIL_GRID_SIZE = 768;

export function clampBoundarySize(boundary: number | undefined): number {
  return Math.max(2, Number.isFinite(boundary) ? Number(boundary) : DEFAULT_BOUNDARY_SIZE);
}

export function getTrailGridSize(boundary = DEFAULT_BOUNDARY_SIZE): number {
  const scaledGridSize = Math.round(clampBoundarySize(boundary) * TRAIL_CELLS_PER_WORLD_UNIT);
  const evenGridSize = Math.max(2, Math.round(scaledGridSize / 2) * 2);
  return Math.max(MIN_TRAIL_GRID_SIZE, Math.min(MAX_TRAIL_GRID_SIZE, evenGridSize));
}
