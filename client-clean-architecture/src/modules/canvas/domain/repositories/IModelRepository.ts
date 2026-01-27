import type { ModelBounds } from '../value-objects/ModelBounds';

/**
 * Model load result containing the loaded model and its bounds.
 */
export interface ModelLoadResult<T = unknown> {
    /** The loaded model object (type depends on implementation) */
    model: T;
    /** Computed bounds of the model */
    bounds: ModelBounds;
    /** Original URL the model was loaded from */
    sourceUrl: string;
}

/**
 * Progress callback for model loading.
 */
export type ModelLoadProgressCallback = (progress: number) => void;

/**
 * Repository interface for model loading operations.
 * Infrastructure implementations will handle Three.js specifics.
 */
export interface IModelRepository<T = unknown> {
    /**
     * Loads a model from a URL.
     *
     * @param url - URL to load the model from
     * @param onProgress - Optional progress callback (0-1)
     * @returns Promise resolving to the load result
     */
    load(url: string, onProgress?: ModelLoadProgressCallback): Promise<ModelLoadResult<T>>;

    /**
     * Checks if a model is currently loading.
     */
    isLoading(): boolean;

    /**
     * Clears the model cache.
     */
    clearCache(): void;

    /**
     * Checks if a URL has previously failed to load.
     */
    hasFailedUrl(url: string): boolean;
}
