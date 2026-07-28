import type * as THREE from 'three';
import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
import { FractalEngine } from '@/modules/fractal/services/fractal-engine';
import type IFractalAssetLoader from '@/modules/fractal/contracts/asset-loader';
import type { BoundsInfo } from '@/modules/fractal/utils/model-transform';
import type { ModelLoadingState } from '@/modules/fractal/contracts/model';
import type { FractalParams } from '@/modules/fractal/services/fractal-engine';
import type { FractalSurface } from '@/modules/fractal/contracts/engine';

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
