import * as THREE from 'three';
import { http } from '@/app/core/http/utilities/create-client';
import { disposeObject3DResources } from '@/modules/fractal/utilities/resource-disposal';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/asset-loader';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class FractalAssetLoader implements IFractalAssetLoader {
    private static readonly MAX_CACHE_ENTRIES = 50;
    private static cache = new Map<string, ArrayBuffer>();
    private static sharedDracoLoader: DRACOLoader | null = null;

    private static createAbortError() {
        const error = new Error('Asset loading was aborted');
        error.name = 'AbortError';
        return error;
    }

    private static getDracoLoader(): DRACOLoader {
        if (!FractalAssetLoader.sharedDracoLoader) {
            FractalAssetLoader.sharedDracoLoader = new DRACOLoader();
            FractalAssetLoader.sharedDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        }
        return FractalAssetLoader.sharedDracoLoader;
    }

    private static evictIfNeeded(): void {
        while (FractalAssetLoader.cache.size >= FractalAssetLoader.MAX_CACHE_ENTRIES) {
            const oldestKey = FractalAssetLoader.cache.keys().next().value;
            if (oldestKey !== undefined) {
                FractalAssetLoader.cache.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    private static createGlbLoader() {
        const gltfLoader = new GLTFLoader();

        try {
            gltfLoader.setDRACOLoader(FractalAssetLoader.getDracoLoader());
            gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        } catch {
        }

        return gltfLoader;
    }

    static clearCache() {
        FractalAssetLoader.cache.clear();
    }

    static async preload(url: string, signal?: AbortSignal): Promise<void> {
        if (FractalAssetLoader.cache.has(url)) return;

        const blob = await http.request<Blob>({
            method: 'GET',
            url,
            signal,
            responseType: 'blob'
        });

        if (signal?.aborted) return;

        const arrayBuffer = await blob.arrayBuffer();

        if (signal?.aborted) return;

        FractalAssetLoader.evictIfNeeded();
        FractalAssetLoader.cache.set(url, arrayBuffer);
    }

    async load(
        url: string,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ): Promise<THREE.Group> {
        if (signal?.aborted) {
            throw FractalAssetLoader.createAbortError();
        }

        const arrayBuffer = await this.getArrayBuffer(url, onProgress, signal);

        if (signal?.aborted) {
            throw FractalAssetLoader.createAbortError();
        }

        return this.parse(arrayBuffer, signal);
    }

    private async getArrayBuffer(
        url: string,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ) {
        if (FractalAssetLoader.cache.has(url)) {
            onProgress?.(1);
            return FractalAssetLoader.cache.get(url)!;
        }

        const blob = await http.request<Blob>({
            method: 'GET',
            url,
            signal,
            responseType: 'blob'
        });

        if (signal?.aborted) {
            throw FractalAssetLoader.createAbortError();
        }

        onProgress?.(1);

        const arrayBuffer = await blob.arrayBuffer();

        if (signal?.aborted) {
            throw FractalAssetLoader.createAbortError();
        }

        FractalAssetLoader.evictIfNeeded();
        FractalAssetLoader.cache.set(url, arrayBuffer);
        return arrayBuffer;
    }

    private parse(arrayBuffer: ArrayBuffer, signal?: AbortSignal): Promise<THREE.Group> {
        return new Promise<THREE.Group>((resolve, reject) => {
            const gltfLoader = FractalAssetLoader.createGlbLoader();
            let settled = false;
            const handleAbort = () => {
                rejectAbort();
            };

            const rejectAbort = () => {
                if (settled) {
                    return;
                }

                settled = true;
                signal?.removeEventListener('abort', handleAbort);
                reject(FractalAssetLoader.createAbortError());
            };

            if (signal?.aborted) {
                rejectAbort();
                return;
            }

            signal?.addEventListener('abort', handleAbort, { once: true });

            gltfLoader.parse(
                arrayBuffer,
                '',
                (gltf: GLTF) => {
                    if (settled) {
                        disposeObject3DResources(gltf.scene);
                        return;
                    }

                    settled = true;
                    signal?.removeEventListener('abort', handleAbort);

                    if (signal?.aborted) {
                        disposeObject3DResources(gltf.scene);
                        reject(FractalAssetLoader.createAbortError());
                        return;
                    }

                    resolve(gltf.scene);
                },
                (error: unknown) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    signal?.removeEventListener('abort', handleAbort);
                    let parsedError: Error;
                    if (error instanceof Error) {
                        parsedError = error;
                    } else {
                        parsedError = new Error(String(error));
                    }
                    reject(parsedError);
                }
            );
        });
    }
};
