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