/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as THREE from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { api } from '@/api';

export const GLB_CONSTANTS = {
    DEFAULT_POSITION: Object.freeze({ x: 0, y: 0, z: 0 }),
    DEFAULT_ROTATION: Object.freeze({ x: 0, y: 0, z: 0 }),
} as const;



export const loadGLB = async (url: string, onProgress?: (progress: number) => void): Promise<THREE.Group> => {
    try {
        const response = await api.get<ArrayBuffer>(url, {
            responseType: 'arraybuffer',
            onDownloadProgress: (evt) => {
                const total = evt.total ?? 0;
                if (total > 0 && onProgress) {
                    onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                }
            }
        });

        const arrayBuffer = response.data;

        // Parse with GLTF loader
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
                    resolve(gltf.scene);
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
