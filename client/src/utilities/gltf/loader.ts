import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { api } from '@/services/api';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('/libs/draco/');
draco.setDecoderConfig({ type: 'wasm' });
loader.setDRACOLoader(draco);

const cache = new Map<string, Promise<GLTF>>();

export const loadGLB = (url: string): Promise<GLTF> => {
    if(!cache.has(url)){
        const loadPromise = new Promise<GLTF>(async (resolve, reject) => {
            try{
                const { data } = await api.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
                const blob = new Blob([data], { type: 'model/gltf-binary' });
                const blobUrl = URL.createObjectURL(blob);

                loader.load(blobUrl, (gltf) => {
                    URL.revokeObjectURL(blobUrl);
                    resolve(gltf);
                }, undefined, (err) => {
                    URL.revokeObjectURL(blobUrl);
                    reject(err);
                });
            }catch(e){
                reject(e);
            }
        });

        cache.set(url, loadPromise);
      }

    return cache.get(url)!;
};

export default loadGLB;