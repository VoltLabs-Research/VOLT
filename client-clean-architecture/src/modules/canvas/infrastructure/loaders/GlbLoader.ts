import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import VoltClient from '@/shared/infrastructure/api';

export const GLB_CONSTANTS = {
    DEFAULT_POSITION: Object.freeze({ x: 0, y: 0, z: 0 }),
    DEFAULT_ROTATION: Object.freeze({ x: 0, y: 0, z: 0 })
} as const;

const glbCache = new Map<string, THREE.Group>();

export const loadGLB = async (url: string, onProgress?: (progress: number) => void): Promise<THREE.Group> => {
    if (glbCache.has(url)) {
        if (onProgress) onProgress(1);
        const cached = glbCache.get(url)!;
        return cached.clone();
    }

    try {
        const client = new VoltClient('');
        const response = await client.request<ArrayBuffer>('get', url, {
            config: {
                responseType: 'arraybuffer',
                onDownloadProgress: (evt) => {
                    const total = evt.total ?? 0;
                    if (total > 0 && onProgress) {
                        onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            },
            dedupe: false
        });

        const arrayBuffer = response.data;

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
                    const scene = gltf.scene;
                    glbCache.set(url, scene);
                    resolve(scene.clone());
                },
                (err: any) => {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            );
        });
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
    }
};

export default loadGLB;
