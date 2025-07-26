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

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();

draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); 
draco.setDecoderConfig({ type: 'wasm' });
draco.preload();

loader.setMeshoptDecoder(MeshoptDecoder);
loader.setDRACOLoader(draco);

self.onmessage = async (event: MessageEvent<{ url: string; token: string | null; id: string }>) => {
    const { url, token, id } = event.data;

    try{
        const headers: HeadersInit = {};
        if(token){
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('http://192.168.1.85:8000/api' + url, { headers });

        if(!response.ok){
            throw new Error(`Error in request: ${url}`);
        }

        const glbBuffer = await response.arrayBuffer();
        const glb = await loader.parseAsync(glbBuffer, '');
        const sceneJSON = glb.scene.toJSON();

        const buffers: ArrayBuffer[] = [];
        glb.parser.getDependencies('buffer').then((bufferViews) => {
             bufferViews.forEach(bufferView => {
                if(!buffers.includes(bufferView.buffer)){
                    buffers.push(bufferView.buffer);
                }
            });
        });
        
        self.postMessage({ status: 'success', sceneJSON, id }, buffers);
    }catch(error: any){
        draco.dispose();
        self.postMessage({ status: 'error', error: error.message, id });
    }
};