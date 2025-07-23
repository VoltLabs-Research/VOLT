import { api } from '@/services/api';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const cache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();

dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/draco_decoder.js');
loader.setDRACOLoader(dracoLoader);

const loadGltfWithCache = (url: string): Promise<GLTF> => {
    if(!cache.has(url)){
        const loadPromise = new Promise<GLTF>(async (resolve, reject) => {
            try{
                const response = await api.get(url, { responseType: 'json' });
                const gltfString = JSON.stringify(response.data);

                const blob = new Blob([ gltfString ], { type: 'model/gltf+json' });
                const blobUrl = URL.createObjectURL(blob);

                loader.load(blobUrl, (gltf) => {
                    URL.revokeObjectURL(blobUrl);
                    resolve(gltf);
                }, undefined, (error) => {
                    URL.revokeObjectURL(blobUrl);
                    reject(error);
                });
            }catch(error){
                reject(error);
            }
        });

        cache.set(url, loadPromise);
    }

    return cache.get(url)!;
};


export default loadGltfWithCache;