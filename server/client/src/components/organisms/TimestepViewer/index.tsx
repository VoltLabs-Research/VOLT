import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'; 
import { Group } from 'three';

const gltfCache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

// Función de carga con caché
const loadGltfWithCache = (url: string): Promise<GLTF> => {
    if (!gltfCache.has(url)) {
        const loadPromise = new Promise<GLTF>((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
        gltfCache.set(url, loadPromise);
    }
    return gltfCache.get(url)!;
};


interface TimestepViewerProps {
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

    useEffect(() => {
        if (nextGltfUrl) {
            loadGltfWithCache(nextGltfUrl);
        }
    }, [nextGltfUrl]);

    useEffect(() => {
        let isMounted = true;

        const updateScene = async () => {
            if (!currentGltfUrl) {
                if (modelRef.current) {
                    scene.remove(modelRef.current);
                    modelRef.current = null;
                }
                return;
            }

            try {
                const gltf = await loadGltfWithCache(currentGltfUrl);
                
                if (!isMounted) return;
                const newModel = gltf.scene.clone();

                newModel.scale.setScalar(scale);
                newModel.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
                newModel.position.set(position.x || 0, position.y || 0, position.z || 0);
                if (modelRef.current) {
                    scene.remove(modelRef.current);
                }
                scene.add(newModel);
                modelRef.current = newModel;

            } catch (error) {
                console.error(`Error al procesar el modelo ${currentGltfUrl}:`, error);
                if (modelRef.current) {
                    scene.remove(modelRef.current);
                    modelRef.current = null;
                }
            }
        };

        updateScene();

        return () => {
            isMounted = false;
        };
    }, [currentGltfUrl, scene, scale, position, rotation]);


    useEffect(() => {
        return () => {
            if (modelRef.current) {
                scene.remove(modelRef.current);
            }
        };
    }, [scene]);

    return null;
};

export default TimestepViewer;