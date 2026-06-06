import type * as THREE from 'three';
import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
import { FractalEngine } from '@/modules/fractal/services/fractal-engine';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/asset-loader';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { FractalParams } from '@/modules/fractal/services/fractal-engine';

interface FractalSurface {
    scene: THREE.Scene;
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
    invalidate: () => void;
}

type FractalEngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};

const assetLoader: IFractalAssetLoader = new FractalAssetLoader();

export const createFractalEngine = (
    surface: FractalSurface,
    params: FractalParams,
    callbacks: FractalEngineCallbacks = {}
): FractalEngine => {
    return new FractalEngine(surface, params, assetLoader, callbacks);
};
