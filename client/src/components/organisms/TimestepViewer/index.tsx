import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { api } from '../../../services/api';
import { useThree, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'; 
import { Group, Box3, Vector3, Sphere } from 'three';

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

                const gltfString = JSON.stringify(gltfData);
                const blob = new Blob([gltfString], { type: 'model/gltf+json' });
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

        gltfCache.set(url, loadPromise);
    }

    return gltfCache.get(url)!;
};

const calculateModelBounds = (gltf: GLTF) => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    
    const boundingSphere = new Sphere();
    box.getBoundingSphere(boundingSphere);
    
    return {
        box,
        size,
        center,
        boundingSphere,
        maxDimension: Math.max(size.x, size.y, size.z)
    };
};

const calculateOptimalTransforms = (bounds: ReturnType<typeof calculateModelBounds>) => {
    const { size, center, maxDimension } = bounds;
    
    const targetSize = 8;
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
    
    const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
    const rotation = shouldRotate ? { x: Math.PI / 2, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };
    
    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };
    
    return { position, rotation, scale };
};

interface CameraManagerProps {
    modelBounds?: ReturnType<typeof calculateModelBounds>;
    orbitControlsRef?: React.MutableRefObject<any>;
}

const CameraManager: React.FC<CameraManagerProps> = ({ modelBounds, orbitControlsRef }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        if (!modelBounds || !orbitControlsRef?.current) return;
        
        const { boundingSphere, maxDimension } = modelBounds;
        const controls = orbitControlsRef.current;
        
        const distance = Math.max(maxDimension * 2, 10);
        const targetHeight = maxDimension * 0.3;
        
        const sphericalCoords = {
            theta: Math.PI / 6,
            phi: Math.PI / 4,
            radius: distance
        };
        
        const x = sphericalCoords.radius * Math.sin(sphericalCoords.phi) * Math.cos(sphericalCoords.theta);
        const y = sphericalCoords.radius * Math.cos(sphericalCoords.phi) + targetHeight;
        const z = sphericalCoords.radius * Math.sin(sphericalCoords.phi) * Math.sin(sphericalCoords.theta);
        
        camera.position.set(x, y, z);
        controls.target.set(0, targetHeight, 0);
        
        controls.minDistance = distance * 0.3;
        controls.maxDistance = distance * 3;
        
        controls.update();
        
    }, [modelBounds, camera, orbitControlsRef]);
    
    return null;
};

interface TimestepViewerProps{
    currentGltfUrl: string | null;
    nextGltfUrl: string | null;
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: React.MutableRefObject<any>;
}

const TimestepViewer: React.FC<TimestepViewerProps> = ({
    currentGltfUrl,
    nextGltfUrl,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef
}) => {
    const { scene } = useThree();
    const modelRef = useRef<Group | null>(null);
    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);

    const updateScene = useCallback(async () => {
        if(!currentGltfUrl && modelRef.current){
            scene.remove(modelRef.current);
            modelRef.current = null;
            setModelBounds(null);
            return;
        }

        try{
            const gltf = await loadGltfWithCache(currentGltfUrl!);
            const newModel = gltf.scene.clone();
            
            if (autoFit) {
                const bounds = calculateModelBounds(gltf);
                const transforms = calculateOptimalTransforms(bounds);
                
                newModel.position.set(
                    (position.x || 0) + transforms.position.x,
                    (position.y || 0) + transforms.position.y,
                    (position.z || 0) + transforms.position.z
                );
                
                newModel.rotation.set(
                    (rotation.x || 0) + transforms.rotation.x,
                    (rotation.y || 0) + transforms.rotation.y,
                    (rotation.z || 0) + transforms.rotation.z
                );
                
                newModel.scale.setScalar(scale * transforms.scale);
                
                const finalBox = new Box3().setFromObject(newModel);
                const minY = finalBox.min.y;
                if (minY < 0) {
                    newModel.position.y += Math.abs(minY) + 0.1;
                }
                
                setModelBounds(bounds);
            } else {
                newModel.scale.setScalar(scale);
                newModel.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
                newModel.position.set(position.x || 0, position.y || 0, position.z || 0);
            }
            
            if(modelRef.current){
                scene.remove(modelRef.current);
            }

            scene.add(newModel);
            modelRef.current = newModel;
            
        }catch(error){
            if(modelRef.current){
                scene.remove(modelRef.current);
                modelRef.current = null;
            }
            setModelBounds(null);
        }
    }, [currentGltfUrl, scene, scale, position, rotation, autoFit]);

    useEffect(() => {
        if(!nextGltfUrl) return;
        loadGltfWithCache(nextGltfUrl).catch(() => {});
    }, [nextGltfUrl]);

    useEffect(() => {
        updateScene();
    }, [updateScene]);

    useEffect(() => {
        return () => {
            if(modelRef.current){
                scene.remove(modelRef.current);
            }
        };
    }, [scene]);

    return (
        <>
            {autoFit && modelBounds && (
                <CameraManager 
                    modelBounds={modelBounds} 
                    orbitControlsRef={orbitControlsRef}
                />
            )}
        </>
    );
};

export default TimestepViewer