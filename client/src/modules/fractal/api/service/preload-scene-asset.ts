import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
import { computeGlbUrl } from '@/modules/fractal/api/service/compute-glb-url';
import type { ComputeGlbUrlParams } from '@/modules/fractal/api/service/compute-glb-url';

interface PreloadFractalSceneAssetOptions {
    signal?: AbortSignal;
}

export const preloadFractalSceneAsset = async (
    params: ComputeGlbUrlParams,
    options?: PreloadFractalSceneAssetOptions
): Promise<void> => {
    const url = computeGlbUrl(params);
    if (!url) return;

    await FractalAssetLoader.preload(url, options?.signal);
};
