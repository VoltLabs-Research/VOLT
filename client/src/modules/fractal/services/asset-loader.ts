import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { http } from '@/app/core/http/utilities/create-client';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/fractal';
import { disposeObject3DResources } from '@/modules/fractal/core/resource-disposal';

export class FractalAssetLoader implements IFractalAssetLoader {
    private static cache = new Map<string, ArrayBuffer>();

    private static createAbortError() {
        const error = new Error('Asset loading was aborted');
        error.name = 'AbortError';
        return error;
    }

    private static createGlbLoader() {
        const gltfLoader = new GLTFLoader();

        try {
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            gltfLoader.setDRACOLoader(dracoLoader);
            gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        } catch {
        }

        return gltfLoader;
    }

    static clearCache() {
        FractalAssetLoader.cache.clear();
    }

    /**
     * Fetches the GLB binary at `url` and stores it in the in-memory cache
     * so that a subsequent `load()` call for the same URL is instant.
     */
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
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            );
        });
    }
}
