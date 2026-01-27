import type { Transform } from './Transform';

/**
 * Domain entity representing the state of a logical canvas scene.
 */
export interface CanvasScene {
    idList: string[];
    mainModelTransform: Transform;
    timesteps: number[];
    currentTimestep?: number;
    analysisId?: string;
    exposureId?: string;
    source: 'plugin' | 'color-coding' | 'particle-filter' | 'default';
}

/**
 * Creates an empty canvas scene.
 */
export const createEmptyScene = (): CanvasScene => ({
    idList: [],
    mainModelTransform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1
    },
    timesteps: [],
    source: 'default'
});
