import React, { useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'; 
import { Group } from 'three';

const gltfCache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/draco_decoder.js'); 
loader.setDRACOLoader(dracoLoader);

const loadGltfWithCache = (url: string): Promise<GLTF> => {
    if(!gltfCache.has(url)){
        const loadPromise = new Promise<GLTF>(async (resolve, reject) => {
            try{
                const response = await api.get(url, { responseType: 'json' });
                const gltfData = response.data;
                console.log('GLTF data received:', gltfData.asset || 'No asset info');

                const gltfString = JSON.stringify(gltfData);
                const blob = new Blob([gltfString], { type: 'model/gltf+json' });
                const blobUrl = URL.createObjectURL(blob);

                loader.load(blobUrl, (gltf) => {
                    URL.revokeObjectURL(blobUrl);
                    console.log('GLTF loaded successfully');
                    resolve(gltf);
                }, (progress) => {
                    console.log('GLTF Loading Progress:', progress);
                }, (error) => {
                    URL.revokeObjectURL(blobUrl);
                    console.log('Error loading GLTF with loader:', error);
                    reject(error);
                });
            }catch(error){
                console.error('Error getting GLTF with axios:', error);
                reject(error);
            }
        });

        gltfCache.set(url, loadPromise);
    }

    return gltfCache.get(url)!;
};

interface TimestepViewerProps{
    currentGltfUrl: string | null;
    nextGltfUrl: string | null;
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
}

const TimestepViewer: React.FC<TimestepViewerProps> = ({
    currentGltfUrl,
    nextGltfUrl,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
}) => {
    const { scene } = useThree();
    const modelRef = useRef<Group | null>(null);

    const updateScene = async () => {
        if(!currentGltfUrl && modelRef.current){
            scene.remove(modelRef.current);
            modelRef.current = null;
            return;
        }

        try{
            console.log('Loading model:', currentGltfUrl);
            const gltf = await loadGltfWithCache(currentGltfUrl!);
            
            const newModel = gltf.scene.clone();
            newModel.scale.setScalar(scale);
            newModel.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
            newModel.position.set(position.x || 0, position.y || 0, position.z || 0);
            
            if(modelRef.current){
                scene.remove(modelRef.current);
            }

            scene.add(newModel);
            modelRef.current = newModel;
            console.log('Model added to scene successfully');
        }catch(error){
            if(modelRef.current){
                scene.remove(modelRef.current);
                modelRef.current = null;
            }
        }
    };

    useEffect(() => {
        if(!nextGltfUrl) return;

        console.log('Preloading next GLTF', nextGltfUrl);
        loadGltfWithCache(nextGltfUrl).catch((error) => {
            console.warn('Error preloading next GLTF:', error);
        });
    }, [nextGltfUrl]);

    useEffect(() => {
        updateScene();
    }, [currentGltfUrl, scene, scale, position, rotation]);

    useEffect(() => {
        return () => {
            if(modelRef.current){
                scene.remove(modelRef.current);
            }
        };
    }, [scene]);

    return null;
};

export default TimestepViewer;