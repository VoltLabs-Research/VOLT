import * as THREE from 'three';

export const getMouseCoordinates = (event: MouseEvent | PointerEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
};

export const getPlaneIntersection = (
    mouseCoords: { x: number; y: number },
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    yOffset: number
) => {
    raycaster.setFromCamera(mouseCoords, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yOffset);
    const intersection = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, intersection);
};

export const isClickNearAtoms = (
    mouseCoords: { x: number; y: number },
    atomPositions: AtomPosition[],
    scale: number,
    yOffset: number,
    groupPosition: THREE.Vector3,
    groupRotation: THREE.Euler,
    raycaster: THREE.Raycaster,
    camera: THREE.Camera
): boolean => {
    raycaster.setFromCamera(mouseCoords, camera);
    
    const sphereRadius = Math.max(0.02, 1 * scale);
    const tempSphere = new THREE.SphereGeometry(sphereRadius, 8, 6);
    const tempMesh = new THREE.Mesh(tempSphere);
    
    for(let i = 0; i < atomPositions.length; i++){
        const atom = atomPositions[i];
        
        const position = new THREE.Vector3(
            atom.x * scale,
            (atom.z * scale) + yOffset,
            atom.y * scale
        );
        
        position.add(groupPosition);
        
        if(!groupRotation.equals(new THREE.Euler(0, 0, 0))){
            const center = atomPositions.reduce((acc, a) => {
                acc.x += a.x * scale;
                acc.y += (a.z * scale) + yOffset;
                acc.z += a.y * scale;
                return acc;
            }, new THREE.Vector3(0, 0, 0));
            center.divideScalar(atomPositions.length);
            
            position.sub(center);
            position.applyEuler(groupRotation);
            position.add(center);
        }
        
        tempMesh.position.copy(position);
        tempMesh.updateMatrixWorld();
        
        const intersects = raycaster.intersectObject(tempMesh);
        if(intersects.length > 0){
            tempSphere.dispose();
            return true;
        }
    }
    
    tempSphere.dispose();
    return false;
};

export const getGroupCenter = (
    atomPositions: any[],
    scale: number,
    yOffset: number,
    groupPosition: THREE.Vector3
) => {
    const center = atomPositions.reduce((acc, atom) => {
        acc.x += atom.x * scale;
        acc.y += (atom.z * scale) + yOffset;
        acc.z += atom.y * scale;
        return acc;
    }, new THREE.Vector3(0, 0, 0));
    center.divideScalar(atomPositions.length);
    center.add(groupPosition);
    return center;
};