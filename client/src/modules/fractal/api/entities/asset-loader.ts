import type * as THREE from 'three';

export default interface IFractalAssetLoader {
    load(
        url: string,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ): Promise<THREE.Group>;
}
