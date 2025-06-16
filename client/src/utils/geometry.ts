import * as THREE from 'three';

interface AtomPosition {
    x: number;
    y: number;
    z: number;
    type: number;
}

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
    const tempAtomPosition = new THREE.Vector3();
    const tempRay = raycaster.ray;

    let center: THREE.Vector3 | null = null;
    if (!groupRotation.equals(new THREE.Euler(0, 0, 0))) {
        center = new THREE.Vector3(0, 0, 0);
        atomPositions.forEach(atom => {
            center.x += atom.x * scale;
            center.y += (atom.z * scale) + yOffset;
            center.z += atom.y * scale;
        });
        center.divideScalar(atomPositions.length);
    }

    for (const atom of atomPositions) {
        tempAtomPosition.set(
            atom.x * scale,
            (atom.z * scale) + yOffset,
            atom.y * scale
        );

        if (center) {
            tempAtomPosition.sub(center);
            tempAtomPosition.applyEuler(groupRotation);
            tempAtomPosition.add(center);
        }

        tempAtomPosition.add(groupPosition);
        
        const distance = tempRay.distanceSqToPoint(tempAtomPosition);
        
        if (distance < sphereRadius * sphereRadius) {
            return true;
        }
    }

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