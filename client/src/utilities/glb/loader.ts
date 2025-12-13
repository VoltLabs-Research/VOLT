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
import { v4 } from 'uuid';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { api } from '@/api';

export const GLB_CONSTANTS = {
    DEFAULT_POSITION: Object.freeze({ x: 0, y: 0, z: 0 }),
    DEFAULT_ROTATION: Object.freeze({ x: 0, y: 0, z: 0 }),
} as const;

interface WorkerRequest {
    id: string;
    resolve: (value: THREE.Group | void) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number) => void;
}

class WorkerGLBLoader{
    private static instance: WorkerGLBLoader;
    private worker: Worker | null = null;
    private readonly pendingRequests = new Map<string, WorkerRequest>();
    private readonly cache = new Map<string, Promise<THREE.Group>>();
    private readonly gltfLoader: GLTFLoader;

    public static getInstance(): WorkerGLBLoader{
        if(!WorkerGLBLoader.instance){
            WorkerGLBLoader.instance = new WorkerGLBLoader();
        }

        return WorkerGLBLoader.instance;
    }

    private constructor(){
        this.gltfLoader = new GLTFLoader();
        this.setupDecoders();
        this.initializeWorker();
    }

    private setupDecoders(): void{
        try{
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            this.gltfLoader.setDRACOLoader(dracoLoader);
            this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        }catch(error){
            console.error('Failed to set up GLTF decoders:', error);
        }
    }

    private initializeWorker(): void{
        if(typeof window === 'undefined' || this.worker) return;
        try{
            this.worker = new Worker(new URL('../../workers/glb.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);
        }catch(error){
            console.error('Failed to initialize Web Worker:', error);
            this.worker = null;
        }
    }

    private handleWorkerMessage(event: MessageEvent): void{
        const { id, type, data, error, progress } = event.data;
        const request = this.pendingRequests.get(id);
        if(!request) return;

        switch(type){
            case 'progress':
                request.onProgress?.(progress);
                break;

            case 'success':
                if(data instanceof ArrayBuffer){
                    this.gltfLoader.parse(
                        data,
                        '',
                        (gltf: any) => {
                            request.resolve(gltf.scene);
                            this.pendingRequests.delete(id);
                        },
                        (err: any) => {
                            const parseError = err instanceof Error ? err : new Error(String(err));
                            request.reject(parseError);
                            this.pendingRequests.delete(id);
                        }
                    );
                }else{
                    request.resolve(undefined);
                    this.pendingRequests.delete(id);
                }
                break;

            case 'error':
                request.reject(new Error(error || 'Unknown worker error'));
                this.pendingRequests.delete(id);
                break;
        }
    }

    private handleWorkerError(error: ErrorEvent): void{
        console.error('A critical error occurred in the GLB worker:', error.message);
        this.pendingRequests.forEach(({ reject }) => reject(new Error('Worker encountered a critical error.')));
        this.pendingRequests.clear();
        this.terminate();
    }

    public async loadGLB(
        url: string,
        token?: string,
        onProgress?: (progress: number) => void
    ): Promise<THREE.Group>{
        if(this.cache.has(url)){
            return this.cache.get(url)!.then((model) => model.clone(true));
        }

        const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
            this.initializeWorker();
            if(!this.worker){
                return reject(new Error('Worker is not available.'));
            }

            const id = v4();
            this.pendingRequests.set(id, { id, resolve: resolve as(value: THREE.Group | void) => void, reject, onProgress });
            this.worker.postMessage({ id, type: 'load', url, token });
        });

        this.cache.set(url, loadPromise);
        return loadPromise.then((model) => model.clone(true));
    }

    public async preloadGLBs(urls: string[], token?: string): Promise<void>{
        this.initializeWorker();
        if(urls.length === 0 || !this.worker) return;

        const id = v4();
        return new Promise<void>((resolve, reject) => {
            this.pendingRequests.set(id, { id, resolve: resolve as any, reject, onProgress: undefined });
            this.worker!.postMessage({ id, type: 'preload', urls, token });
        });
    }

    public clearCache(): void{
        this.cache.clear();
        if(this.worker){
            this.worker.postMessage({ id: v4(), type: 'cleanup' });
        }
    }

    public terminate(): void{
        if(this.worker){
            this.worker.terminate();
            this.worker = null;
        }

        this.pendingRequests.clear();
        this.cache.clear();
    }
};

const workerLoader = WorkerGLBLoader.getInstance();

export const loadGLB = async(url: string, onProgress?: (progress: number) => void): Promise<THREE.Group> => {
    try{
        const response = await api.get<ArrayBuffer>(url, {
            responseType: 'arraybuffer',
            onDownloadProgress: (evt) => {
                const total = evt.total ?? 0;
                if(total > 0 && onProgress){
                    onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                }
            }
        });

        const arrayBuffer = response.data;

        // Parse with GLTF loader
        return new Promise<THREE.Group>((resolve, reject) => {
            const gltfLoader = new GLTFLoader();
            try{
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
                gltfLoader.setDRACOLoader(dracoLoader);
                gltfLoader.setMeshoptDecoder(MeshoptDecoder);
            }catch(error){
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
    }catch(error){
        throw error instanceof Error ? error : new Error(String(error));
    }
};

export const preloadGLBs = (): void => {
    // Preload disabled
    return;
};

export const clearModelCache = (): void => {
    workerLoader.clearCache();
};

export default loadGLB;
