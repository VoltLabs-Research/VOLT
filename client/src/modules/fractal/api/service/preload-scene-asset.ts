import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
import { resolveGlbResource } from '@/modules/fractal/api/service/compute-glb-url';
import type { ComputeGlbUrlParams } from '@/modules/fractal/api/service/compute-glb-url';

interface PreloadFractalSceneAssetOptions {
    signal?: AbortSignal;
}

export const preloadFractalSceneAsset = async (
    params: ComputeGlbUrlParams,
    options?: PreloadFractalSceneAssetOptions
): Promise<void> => {
    const { url, resourceKey } = resolveGlbResource(params);
    if (!url || !resourceKey) return;

    await FractalAssetLoader.preload(url, options?.signal, resourceKey);
};
