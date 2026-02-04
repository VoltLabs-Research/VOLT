import { ANIMATION_CONSTANTS } from '@/features/canvas/utilities/simulation-box';
import { makeSelectionGroup, updateSelectionGeometry } from '@/features/canvas/utilities/selection';
import { Box3, Group, Vector3, Scene } from 'three';
import type { ExtendedSceneState } from '@/features/canvas/types';

export default class SelectionManager {
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private invalidate: () => void
    ){}

    createSelectionGroup(hover = false): Group {
        const group = new Group();
        return group;
    }

    show(hover = false): void {
        if (!this.state.model) return;
        this.createSelectionGroup(hover);
    }

    hide(): void {
        this.state.showSelection = false;
        if (this.state.selection) {
            this.scene.remove(this.state.selection.group);
            this.state.selection = null;
        }
    }

    deselect(): void {
        this.state.isSelectedPersistent = false;
        this.state.selected = null;
        this.hide();
        this.invalidate();
    }

    isSelected(): boolean {
        return this.state.isSelectedPersistent;
    }

    isHovered(): boolean {
        return this.state.isHovered;
    }
};
