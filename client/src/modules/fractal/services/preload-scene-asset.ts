import { computeGlbUrl, type ComputeGlbUrlParams } from '@/modules/fractal/services/compute-glb-url';
import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';

/**
 * Computes the GLB URL for the given scene parameters and fetches the
 * binary data into the asset-loader cache so that rendering is instant
 * when the timestep is reached during playback.
 */
export const preloadFractalSceneAsset = async (
    params: ComputeGlbUrlParams,
    options?: { signal?: AbortSignal }
): Promise<void> => {
    const url = computeGlbUrl(params);
    if (!url) return;

    await FractalAssetLoader.preload(url, options?.signal);
};
