import * as THREE from 'three';
import type { SceneState } from '@/types/scene';
import { updateSelectionGeometry } from '@/features/canvas/utilities/selection';

export const ANIMATION_CONSTANTS = {
    SELECTION_LERP_SPEED: 0.18,
    SCALE_LERP_SPEED: 0.08,
    ROTATION_LERP_SPEED: 0.1,
    POSITION_LERP_SPEED: 0.08,
    PULSE_SPEED: 0.003,
    MIN_SCALE: 0.1,
    MAX_SCALE: 5.0,
    SCALE_STEP: 0.1,
    ROTATION_STEP: Math.PI / 24,
    SELECTION_BOX_PADDING: 1.06,
    HOVER_BOX_PADDING: 1.04,

    ROT_EPS: 1e-3,
    ROTATION_SETTLE_MS: 160,
    SIZE_ANIM_DURATION_MS: 240
};

export const ensureSimulationBox = (state: SceneState, scene: THREE.Scene, box: THREE.Box3) => {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const EPS = 1e-4;
    if(!state.simBoxMesh){
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);

        mesh.name = 'SimInvisibleRaycastBox';
        mesh.visible = true;
        mesh.renderOrder = -1;

        scene.add(mesh);
        state.simBoxMesh = mesh;
        state.simBoxBaseSize = size.clone();
        state.simBoxSize = size.clone();
    }else if(!state.sizeAnimActive && !state.isRotating){
        const simulationBox = state.simBoxMesh!;
        const currentBox = state.simBoxSize!;
        if(Math.abs(currentBox.x - size.x) > EPS ||
            Math.abs(currentBox.y - size.y) > EPS ||
            Math.abs(currentBox.z - size.z) > EPS
        ){
            simulationBox.geometry.dispose();
            simulationBox.geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            simulationBox.scale.set(1, 1, 1);

            state.simBoxBaseSize = size.clone();
            state.simBoxSize = size.clone();
        }
    }

    state.simBoxMesh!.position.copy(center);
};

export const startSizeAnimAfterRotation = (state: SceneState, scene: THREE.Scene, now: number) => {
    const box = new THREE.Box3().setFromObject(state.model!);
    const sizeWorld = new THREE.Vector3();
    box.getSize(sizeWorld);
    const hover = state.isHovered && !state.isSelectedPersistent;
    const padding = hover ? ANIMATION_CONSTANTS.HOVER_BOX_PADDING : ANIMATION_CONSTANTS.SELECTION_BOX_PADDING;
    const sizeTarget = sizeWorld.multiplyScalar(padding);

    let sizeFrom = state.rotationFreezeSize?.clone();
    if(!sizeFrom && state.selection){
        const g = state.selection.base.geometry;
        (g as any).computeBoundingBox?.();
        const bb = (g as any).boundingBox!;
        sizeFrom = new THREE.Vector3();
        bb.getSize(sizeFrom);
    }

    if(!sizeFrom) sizeFrom = sizeTarget.clone();

    state.sizeAnimFrom = sizeFrom.clone();
    state.sizeAnimTo = sizeTarget.clone();
    state.sizeAnimStartMs = now;
    state.sizeAnimActive = true;

    if(state.simBoxMesh){
        state.simBoxMesh.geometry.dispose();
        state.simBoxMesh.geometry = new THREE.BoxGeometry(sizeFrom.x, sizeFrom.y, sizeFrom.z);
        state.simBoxMesh.scale.set(1, 1, 1);
    }

    state.simBoxBaseSize = sizeFrom.clone();
    state.simBoxSize = sizeFrom.clone();
};

export const runSizeAnimationStep = (state: SceneState, now: number) => {
    if(!state.sizeAnimActive ||
        !state.selection ||
        !state.sizeAnimFrom ||
        !state.sizeAnimTo){
        return false;
    }

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const t = Math.min(1, (now - state.sizeAnimStartMs) / ANIMATION_CONSTANTS.SIZE_ANIM_DURATION_MS);
    const tt = easeOutCubic(t);

    const cur = new THREE.Vector3(
        state.sizeAnimFrom.x + (state.sizeAnimTo.x - state.sizeAnimFrom.x) * tt,
        state.sizeAnimFrom.y + (state.sizeAnimTo.y - state.sizeAnimFrom.y) * tt,
        state.sizeAnimFrom.z + (state.sizeAnimTo.z - state.sizeAnimFrom.z) * tt
    );

    const hover = state.isHovered && !state.isSelectedPersistent;
    updateSelectionGeometry(state.selection, cur, hover);

    if(state.simBoxMesh && state.simBoxBaseSize){
        state.simBoxMesh.scale.set(
            cur.x / state.simBoxBaseSize.x,
            cur.y / state.simBoxBaseSize.y,
            cur.z / state.simBoxBaseSize.z
        );
        state.simBoxSize = cur.clone();
    }

    if(t >= 1){
        if(state.simBoxMesh){
            state.simBoxMesh.geometry.dispose();
            state.simBoxMesh.geometry = new THREE.BoxGeometry(state.sizeAnimTo.x, state.sizeAnimTo.y, state.sizeAnimTo.z);
            state.simBoxMesh.scale.set(1, 1, 1);
        }

        state.simBoxBaseSize = state.sizeAnimTo.clone();
        state.simBoxSize = state.sizeAnimTo.clone();
        state.sizeAnimActive = false;
    }

    return true;
};
