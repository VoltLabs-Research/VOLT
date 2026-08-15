import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';
import { FractalEngine } from '@/modules/fractal/services/fractal-engine';
import type IFractalAssetLoader from '@/modules/fractal/contracts/asset-loader';
import type { EngineCallbacks, FractalParams } from '@/modules/fractal/services/fractal-engine';
import type { FractalSurface } from '@/modules/fractal/contracts/engine';

const assetLoader: IFractalAssetLoader = new FractalAssetLoader();

export const createFractalEngine = (
    surface: FractalSurface,
    params: FractalParams,
    callbacks: EngineCallbacks = {}
): FractalEngine => {
    return new FractalEngine(surface, params, assetLoader, callbacks);
};
