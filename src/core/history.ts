import type { SerializableAppState } from '../types';

function cloneState(state: SerializableAppState): SerializableAppState {
  return {
    foodPoints: state.foodPoints.map((point) => ({ ...point })),
    foodSettings: { ...state.foodSettings },
    particleSettings: { ...state.particleSettings },
    material: { ...state.material },
  };
}

function stateKey(state: SerializableAppState): string {
  return JSON.stringify(state);
}

export class HistoryController {
  private past: SerializableAppState[] = [];
  private future: SerializableAppState[] = [];
  private current: SerializableAppState;

  constructor(initialState: SerializableAppState) {
    this.current = cloneState(initialState);
  }

  get undoCount(): number {
    return this.past.length;
  }

  get redoCount(): number {
    return this.future.length;
  }

  reset(state: SerializableAppState): void {
    this.past = [];
    this.future = [];
    this.current = cloneState(state);
  }

  commit(nextState: SerializableAppState): void {
    if (stateKey(this.current) === stateKey(nextState)) {
      return;
    }
    this.past.push(cloneState(this.current));
    this.future = [];
    this.current = cloneState(nextState);
  }

  undo(): SerializableAppState | null {
    const previous = this.past.pop();
    if (!previous) {
      return null;
    }
    this.future.push(cloneState(this.current));
    this.current = cloneState(previous);
    return cloneState(previous);
  }

  redo(): SerializableAppState | null {
    const next = this.future.pop();
    if (!next) {
      return null;
    }
    this.past.push(cloneState(this.current));
    this.current = cloneState(next);
    return cloneState(next);
  }
}
