import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { http } from '@/app/di';

export class AssetLoader {
    private static cache = new Map<string, THREE.Group>();

    async load(url: string, onProgress?: (progress: number) => void): Promise<THREE.Group> {
        if (AssetLoader.cache.has(url)) {
            onProgress?.(1);
            return AssetLoader.cache.get(url)!.clone();
        }

        const blob = await http.request<Blob>({
            method: 'GET',
            url,
            responseType: 'blob'
        });

        onProgress?.(1);

        const arrayBuffer = await blob.arrayBuffer();

        return new Promise<THREE.Group>((resolve, reject) => {
            const gltfLoader = new GLTFLoader();
            try {
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
                gltfLoader.setDRACOLoader(dracoLoader);
                gltfLoader.setMeshoptDecoder(MeshoptDecoder);
            } catch (error) {
                console.error('Failed to set up GLTF decoders:', error);
            }

            gltfLoader.parse(
                arrayBuffer,
                '',
                (gltf: any) => {
                    const scene = gltf.scene as THREE.Group;
                    AssetLoader.cache.set(url, scene);
                    resolve(scene.clone());
                },
                (err: any) => {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            );
        });
    }
}
