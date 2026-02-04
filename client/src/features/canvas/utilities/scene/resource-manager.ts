import { Group, Scene, MeshBasicMaterial, Object3D } from 'three';
import type { ExtendedSceneState } from '@/features/canvas/types';

export default class ResourceManager {
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private invalidate: () => void
    ){}

    cleanup(): void {
        this.cleanupModels();
        this.cleanupSelection();
        this.cleanupSimulationBox();
        this.resetState();
        this.invalidate();
    }

    private cleanupModels(): void {
        if (this.state.model) {
            this.scene.remove(this.state.model);
            this.state.model = null;
        }
    }

    swapModel(activeModel: Object3D | null, newModel: Object3D): void {
        // Scene graph manipulation is now handled by React via <primitive />
        this.state.model = newModel as Group;
    }

    private cleanupSelection(): void {
        if (this.state.selection) {
            this.scene.remove(this.state.selection.group)
            this.state.selection = null;
        }
    }

    private cleanupSimulationBox(): void {
        if (this.state.simBoxMesh) {
            this.scene.remove(this.state.simBoxMesh);
            this.state.simBoxMesh.geometry.dispose();
            (this.state.simBoxMesh.material as MeshBasicMaterial).dispose();
            this.state.simBoxMesh = null;
            this.state.simBoxSize = null;
            this.state.simBoxBaseSize = null;
        }
    }

    private resetState(): void {
        this.state.model = null;
        this.state.mesh = null;
        this.state.isSetup = false;
        this.state.selected = null;
        this.state.isSelectedPersistent = false;
        this.state.isRotating = false;
        this.state.rotationFreezeSize = null;
        this.state.sizeAnimActive = false;
        this.state.referenceScaleFactor = undefined;
        this.state.fixedReferencePoint = null;
        this.state.useFixedReference = false;
        this.state.initialTransform = null;
    }
};
