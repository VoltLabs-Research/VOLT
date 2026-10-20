import * as THREE from 'three';

const EDGES_OVERLAY_NAME = '__fractalEdgesOverlay';

const EDGES_THRESHOLD_ANGLE = 20;
const EDGES_COLOR = 0x0a0a0a;
const EDGES_OPACITY = 0.45;

const createEdgesOverlay = (mesh: THREE.Mesh, clippingPlanes: THREE.Plane[]): THREE.LineSegments => {
    const geometry = new THREE.EdgesGeometry(mesh.geometry, EDGES_THRESHOLD_ANGLE);
    const material = new THREE.LineBasicMaterial({
        color: EDGES_COLOR,
        transparent: true,
        opacity: EDGES_OPACITY,
        clippingPlanes
    });
    const overlay = new THREE.LineSegments(geometry, material);
    overlay.name = EDGES_OVERLAY_NAME;
    overlay.raycast = () => undefined;
    return overlay;
};

const getOverlayMaterial = (overlay: THREE.LineSegments): THREE.LineBasicMaterial => {
    return overlay.material as THREE.LineBasicMaterial;
};

const disposeEdgesOverlay = (overlay: THREE.LineSegments): void => {
    overlay.removeFromParent();
    overlay.geometry.dispose();
    getOverlayMaterial(overlay).dispose();
};

export const applyMeshEdgesOverlay = (
    meshes: ReadonlyArray<THREE.Mesh>,
    enabled: boolean,
    clippingPlanes: THREE.Plane[]
): void => {
    meshes.forEach((mesh) => {
        const existing = mesh.getObjectByName(EDGES_OVERLAY_NAME) as THREE.LineSegments | undefined;
        if (enabled) {
            if (!existing) {
                mesh.add(createEdgesOverlay(mesh, clippingPlanes));
            }
            return;
        }

        if (existing) {
            disposeEdgesOverlay(existing);
        }
    });
};

export const syncMeshEdgesClippingPlanes = (
    meshes: ReadonlyArray<THREE.Mesh>,
    clippingPlanes: THREE.Plane[]
): void => {
    meshes.forEach((mesh) => {
        const overlay = mesh.getObjectByName(EDGES_OVERLAY_NAME) as THREE.LineSegments | undefined;
        if (!overlay) return;
        const material = getOverlayMaterial(overlay);
        if (material.clippingPlanes === clippingPlanes) return;
        material.clippingPlanes = clippingPlanes;
        material.needsUpdate = true;
    });
};
