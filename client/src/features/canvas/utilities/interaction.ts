import * as THREE from 'three';
import { ANIMATION_CONSTANTS } from '@/features/canvas/utilities/simulation-box';
import type { SceneState } from '@/types/scene';

export const attachPointerEvents = (params: {
    glCanvas: HTMLCanvasElement;
    camera: THREE.Camera;
    scene: THREE.Scene;
    raycaster: THREE.Raycaster;
    groundPlane: THREE.Plane;
    state: SceneState;
    showSelectionBox: (hover?: boolean) => void;
    hideSelectionBox: () => void;
    deselect: () => void;
    onSelect?: () => void;
    setOrbitControlsEnabled?: (enabled: boolean) => void;
}) => {
    const {
        glCanvas,
        camera,
        raycaster,
        groundPlane,
        state,
        showSelectionBox,
        hideSelectionBox,
        deselect,
        onSelect,
        setOrbitControlsEnabled
    } = params;

    const mouse = new THREE.Vector3();
    let lastClickTime = 0;
    const dragOffset = new THREE.Vector3();

    const handlePointerDown = (event: MouseEvent) => {
        if (!state.model || !state.simBoxMesh) {
            console.warn('[Interaction] Model or SimBoxMesh missing', { model: !!state.model, simBoxMesh: !!state.simBoxMesh });
            return;
        }

        const rect = glCanvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        // @ts-ignore
        raycaster.setFromCamera({ x: mouse.x, y: mouse.y }, camera);

        if (event.button === 0) {
            const simHits = raycaster.intersectObject(state.simBoxMesh, false);

            if (simHits.length > 0) {
                if (!state.isSelectedPersistent) {
                    state.isSelectedPersistent = true;
                    // Select the parent Group of the mesh, which is the container for the entire simulation box + GLB
                    state.selected = (state.simBoxMesh.parent as THREE.Group) || state.simBoxMesh;
                    showSelectionBox(false);
                    if (onSelect) onSelect();
                }

                const now = Date.now();
                if (now - lastClickTime < 300) {
                    // Double click triggered - start drag
                    state.dragging = true;

                    // Calculate offset
                    const intersection = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
                    if (intersection && state.selected) {
                        dragOffset.copy(state.selected.position).sub(intersection);
                    }

                    if (setOrbitControlsEnabled) setOrbitControlsEnabled(false);
                } else {
                    // Reset drag state just in case
                    state.dragging = false;
                }
                lastClickTime = now;
            }
        } else {
            deselect();
        }
    };

    const handlePointerMove = (event: MouseEvent) => {
        if (!state.model || !state.simBoxMesh) return;

        const rect = glCanvas.getBoundingClientRect();
        const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // @ts-ignore
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

        const simHits = raycaster.intersectObject(state.simBoxMesh, false);
        const wasHovered = state.isHovered;
        state.isHovered = simHits.length > 0;

        if (state.isHovered && !state.isSelectedPersistent && !state.selection) {
            showSelectionBox(true);
        } else if (!state.isHovered && !state.isSelectedPersistent && wasHovered) {
            hideSelectionBox();
        }

        const intersection = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
        if (state.dragging && state.selected && intersection) {
            const target = intersection.clone().add(dragOffset);
            state.targetPosition = new THREE.Vector3(target.x, target.y, Math.max(0, target.z));
        }
    };

    const handlePointerUp = (event: MouseEvent) => {
        if (event.button === 0) {
            if (state.dragging) {
                state.dragging = false;
                state.targetPosition = null;
                if (setOrbitControlsEnabled) setOrbitControlsEnabled(true);
            }
        }
    };

    glCanvas.addEventListener('pointerdown', handlePointerDown);
    glCanvas.addEventListener('pointermove', handlePointerMove);
    glCanvas.addEventListener('pointerup', handlePointerUp);

    return () => {
        glCanvas.removeEventListener('pointerdown', handlePointerDown);
        glCanvas.removeEventListener('pointermove', handlePointerMove);
        glCanvas.removeEventListener('pointerup', handlePointerUp);
    };
};

export const attachKeyboard = (params: {
    state: SceneState;
    rotateModel: (dx: number, dy: number, dz: number) => void;
    scaleModel: (delta: number) => void;
    deselect: () => void;
}) => {
    const { state, rotateModel, scaleModel, deselect } = params;

    const handleKeyDown = (event: KeyboardEvent) => {
        const isCtrl = event.ctrlKey || event.metaKey;
        if (!state.selected) return;

        if (isCtrl) {
            switch (event.code) {
                case 'ArrowUp': event.preventDefault(); rotateModel(-ANIMATION_CONSTANTS.ROTATION_STEP, 0, 0); break;
                case 'ArrowDown': event.preventDefault(); rotateModel(ANIMATION_CONSTANTS.ROTATION_STEP, 0, 0); break;
                case 'ArrowLeft': event.preventDefault(); rotateModel(0, -ANIMATION_CONSTANTS.ROTATION_STEP, 0); break;
                case 'ArrowRight': event.preventDefault(); rotateModel(0, ANIMATION_CONSTANTS.ROTATION_STEP, 0); break;
                case 'Equal':
                case 'NumpadAdd': event.preventDefault(); scaleModel(ANIMATION_CONSTANTS.SCALE_STEP); break;
                case 'Minus':
                case 'NumpadSubtract': event.preventDefault(); scaleModel(-ANIMATION_CONSTANTS.SCALE_STEP); break;
            }
        } else if (event.shiftKey) {
            switch (event.code) {
                case 'ArrowLeft': event.preventDefault(); rotateModel(0, 0, -ANIMATION_CONSTANTS.ROTATION_STEP); break;
                case 'ArrowRight': event.preventDefault(); rotateModel(0, 0, ANIMATION_CONSTANTS.ROTATION_STEP); break;
            }
        }

        if (event.key === 'Escape') deselect();
    };

    const handleKeyUp = (_event: KeyboardEvent) => { };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
};
