import type * as THREE from 'three';
import { FractalEngine, type FractalParams } from '@/modules/fractal/services/fractal-engine';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/fractal';
import type { BoundsInfo } from '@/modules/fractal/core/model-transform';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/fractal';
import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';

export type FractalEngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
};

const assetLoader: IFractalAssetLoader = new FractalAssetLoader();

export default class FractalEngineFactory {
    create(
        surface: {
            scene: THREE.Scene;
            camera: THREE.Camera;
            gl: THREE.WebGLRenderer;
            invalidate: () => void;
        },
        params: FractalParams,
        callbacks: FractalEngineCallbacks = {}
    ): FractalEngine {
        return new FractalEngine(surface, params, assetLoader, callbacks);
    }
}

const engineFactory = new FractalEngineFactory();

export const createFractalEngine = (
    surface: {
        scene: THREE.Scene;
        camera: THREE.Camera;
        gl: THREE.WebGLRenderer;
        invalidate: () => void;
    },
    params: FractalParams,
    callbacks: FractalEngineCallbacks = {}
): FractalEngine => {
    return engineFactory.create(surface, params, callbacks);
};
