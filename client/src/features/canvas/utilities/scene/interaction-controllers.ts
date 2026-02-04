import type { ExtendedSceneState } from '@/features/canvas/types';
import { Camera, Scene, WebGLRenderer, Raycaster, Plane } from 'three';
import { attachPointerEvents, attachKeyboard } from '@/features/canvas/utilities/interaction';
import SelectionManager from '@/features/canvas/utilities/scene/selection-manager';
import TransformationManager from '@/features/canvas/utilities/scene/transformation-manager';

export default class InteractionController {
    constructor(
        private state: ExtendedSceneState,
        private camera: Camera,
        private scene: Scene,
        private gl: WebGLRenderer,
        private raycaster: Raycaster,
        private groundPlane: Plane,
        private selectionManager: SelectionManager,
        private transformManager: TransformationManager,

        private detachPointer?: () => void,
        private detachKeyboard?: () => void,
        private onSelect?: () => void,
        private orbitControlsRef?: any
    ){}

    setCamera(camera: Camera): void {
        this.camera = camera;
    }


    attach(): void {
        if (!this.gl.domElement) return;

        this.detachPointer = attachPointerEvents({
            glCanvas: this.gl.domElement,
            camera: this.camera,
            scene: this.scene,
            raycaster: this.raycaster,
            groundPlane: this.groundPlane,
            // @ts-ignore
            state: this.state,
            showSelectionBox: (hover) => this.selectionManager.show(!!hover),
            hideSelectionBox: () => this.selectionManager.hide(),
            deselect: () => this.selectionManager.deselect(),
            onSelect: this.onSelect,
            setOrbitControlsEnabled: (enabled) => {
                if (this.orbitControlsRef?.current) {
                    this.orbitControlsRef.current.enabled = enabled;
                }
            }
        });

        this.detachKeyboard = attachKeyboard({
            // @ts-ignore
            state: this.state,
            rotateModel: (dx, dy, dz) => this.transformManager.rotate(dx, dy, dz),
            scaleModel: (delta) => this.transformManager.scale(delta),
            deselect: () => this.selectionManager.deselect()
        });
    }

    detach(): void {
        this.detachPointer?.();
        this.detachKeyboard?.();
    }
};
