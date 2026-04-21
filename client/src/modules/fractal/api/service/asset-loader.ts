import * as THREE from 'three';
import { http } from '@/app/core/http/utilities/create-client';
import { disposeObject3DResources } from '@/modules/fractal/utilities/resource-disposal';
import { debugFractal, warnFractal } from '@/modules/fractal/utilities/debug-log';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { geometryPool } from '@/modules/fractal/services/geometry-pool';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/asset-loader';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const summarizeRenderableContent = (root: THREE.Object3D) => {
    let points = 0;
    let meshes = 0;
    let vertices = 0;
    root.traverse((child) => {
        if (child instanceof THREE.Points) {
            points += 1;
            vertices += child.geometry.getAttribute('position')?.count ?? 0;
            return;
        }
        if (child instanceof THREE.Mesh) {
            meshes += 1;
            vertices += child.geometry.getAttribute('position')?.count ?? 0;
        }
    });
    return { points, meshes, vertices };
};

// FractalAssetLoader: downloads the GLB bytes, parses, and caches both the
// raw ArrayBuffer (for fast re-parse) and the parsed BufferGeometry (via the
// GeometryPool). Parsed geometries avoid the GLTFLoader cost on hot paths.

export class FractalAssetLoader implements IFractalAssetLoader {
    private static sharedDracoLoader: DRACOLoader | null = null;

    private static createAbortError() {
        const error = new Error('Asset loading was aborted');
        error.name = 'AbortError';
        return error;
    }

    private static isDirectBrowserAssetUrl(url: string): boolean {
        return url.startsWith('blob:') || url.startsWith('data:');
    }

    private static async requestBlob(url: string, signal?: AbortSignal): Promise<Blob> {
        if (FractalAssetLoader.isDirectBrowserAssetUrl(url)) {
            const response = await fetch(url, { signal });
            if (!response.ok) {
                throw new Error(`Failed to load local GLB (status ${response.status})`);
            }
            return response.blob();
        }
        return http.request<Blob>({
            method: 'GET',
            url,
            signal,
            responseType: 'blob'
        });
    }

    private static getDracoLoader(): DRACOLoader {
        if (!FractalAssetLoader.sharedDracoLoader) {
            FractalAssetLoader.sharedDracoLoader = new DRACOLoader();
            FractalAssetLoader.sharedDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        }
        return FractalAssetLoader.sharedDracoLoader;
    }

    private static createGlbLoader() {
        const gltfLoader = new GLTFLoader();
        try {
            gltfLoader.setDRACOLoader(FractalAssetLoader.getDracoLoader());
            gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        } catch {
            // Optional decoders: swallow errors and fall back to undecorated loader.
        }
        return gltfLoader;
    }

    static clearCache() {
        geometryPool.clear();
    }

    static async preload(url: string, signal?: AbortSignal): Promise<void> {
        if (geometryPool.get(url)) return;
        const existing = await geometryPool.readFromOpfs(url);
        if (existing) return;
        const blob = await FractalAssetLoader.requestBlob(url, signal);
        if (signal?.aborted) return;
        const arrayBuffer = await blob.arrayBuffer();
        if (signal?.aborted) return;
        await geometryPool.writeToOpfs(url, arrayBuffer);
    }

    async load(
        url: string,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ): Promise<THREE.Group> {
        if (signal?.aborted) throw FractalAssetLoader.createAbortError();

        const cached = geometryPool.get(url);
        if (cached) {
            onProgress?.(1);
            debugFractal('asset-loader.geometry-cache-hit', { url });
            return this.wrapGeometry(cached);
        }

        let arrayBuffer = await geometryPool.readFromOpfs(url);
        if (!arrayBuffer) {
            const blob = await FractalAssetLoader.requestBlob(url, signal);
            if (signal?.aborted) throw FractalAssetLoader.createAbortError();
            arrayBuffer = await blob.arrayBuffer();
            if (signal?.aborted) throw FractalAssetLoader.createAbortError();
            debugFractal('asset-loader.fetch-complete', { url, bytes: arrayBuffer.byteLength });
            void geometryPool.writeToOpfs(url, arrayBuffer);
        } else {
            debugFractal('asset-loader.opfs-hit', { url, bytes: arrayBuffer.byteLength });
        }
        onProgress?.(1);

        const group = await this.parse(arrayBuffer, signal);
        const geometry = this.extractRenderableGeometry(group);
        if (geometry) {
            geometryPool.insert(url, geometry);
        }
        return group;
    }

    private wrapGeometry(geometry: THREE.BufferGeometry): THREE.Group {
        const group = new THREE.Group();
        // Why: the engine expects a THREE.Points; wrap the cached geometry.
        const points = new THREE.Points(geometry.clone(), new THREE.PointsMaterial({ size: 1 }));
        group.add(points);
        return group;
    }

    private extractRenderableGeometry(group: THREE.Group): THREE.BufferGeometry | null {
        let found: THREE.BufferGeometry | null = null;
        group.traverse((child) => {
            if (found) return;
            if (child instanceof THREE.Points) {
                found = child.geometry;
            }
        });
        return found;
    }

    private parse(arrayBuffer: ArrayBuffer, signal?: AbortSignal): Promise<THREE.Group> {
        return new Promise<THREE.Group>((resolve, reject) => {
            const gltfLoader = FractalAssetLoader.createGlbLoader();
            let settled = false;
            const handleAbort = () => { rejectAbort(); };
            const rejectAbort = () => {
                if (settled) return;
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
                    debugFractal('asset-loader.parse-success', summarizeRenderableContent(gltf.scene));
                    resolve(gltf.scene);
                },
                (error: unknown) => {
                    if (settled) return;
                    settled = true;
                    signal?.removeEventListener('abort', handleAbort);
                    let parsedError: Error;
                    if (error instanceof Error) parsedError = error;
                    else parsedError = new Error(String(error));
                    warnFractal('asset-loader.parse-failed', { message: parsedError.message });
                    reject(parsedError);
                }
            );
        });
    }
}
