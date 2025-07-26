import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { calculateModelBounds } from '@/utilities/glb/modelUtils';

interface CameraManagerProps {
    modelBounds?: ReturnType<typeof calculateModelBounds>;
    orbitControlsRef?: any;
}

const CameraManager: React.FC<CameraManagerProps> = ({ modelBounds, orbitControlsRef }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        if (!modelBounds || !orbitControlsRef?.current) return;
        
        const { maxDimension } = modelBounds;
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

export default CameraManager;