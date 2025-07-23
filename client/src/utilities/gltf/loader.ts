/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import * as THREE from 'three';
import { v4 } from 'uuid';

// TODO: CLEAR
const cache = new Map<string, Promise<any>>();
let worker: Worker | undefined;

const pendingRequests = new Map<string, { resolve: (value: THREE.Group) => void; reject: (reason?: any) => void }>();

const getWorker = () => {
    if(!worker){
        const newWorker = new Worker(new URL('../../workers/gltf.ts', import.meta.url), { type: 'module' });
        newWorker.onmessage = (event: MessageEvent) => {
            const { status, sceneJSON, error, id } = event.data;
            const request = pendingRequests.get(id);
            
            if(request){
                if(status === 'success'){
                    const objectLoader = new THREE.ObjectLoader();
                    const scene = objectLoader.parse(sceneJSON);
                    request.resolve(scene as THREE.Group);
                }else{
                    request.reject(new Error(error));
                }

                pendingRequests.delete(id);
            }
        };

        worker = newWorker;
    }

    return worker;
};

export const preloadGLTFs = (urls: string[]): void => {
    for(const url of urls){
        loadGLTF(url);
    }
}

const loadGLTF = (url: string): Promise<THREE.Group> => {
    if(cache.has(url)){
        return cache.get(url)! as Promise<THREE.Group>;
    }

    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
        const workerInstance = getWorker();
        const id = v4();
        
        pendingRequests.set(id, { resolve, reject });

        const token = localStorage.getItem('authToken');
        workerInstance.postMessage({ url, token, id });
    });

    cache.set(url, loadPromise);

    return loadPromise;
};

export default loadGLTF;