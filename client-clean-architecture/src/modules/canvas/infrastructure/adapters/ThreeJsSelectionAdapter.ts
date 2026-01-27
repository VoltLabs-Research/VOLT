import * as THREE from 'three';
import type { Position3D } from '../../domain/value-objects/Position3D';

/**
 * Selection visual references.
 */
export interface SelectionRefs {
    group: THREE.Group;
    base: THREE.LineSegments;
}

/**
 * Selection colors.
 */
const COLORS = {
    SELECTED: 0x00ffff, // cyan
    HOVERED: 0xffff00   // yellow
} as const;

/**
 * Adapter for Three.js selection visualization.
 */
export class ThreeJsSelectionAdapter {
    /**
     * Creates a selection group with box edges.
     */
    createSelectionGroup(): SelectionRefs {
        const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        const material = new THREE.LineBasicMaterial({
            color: COLORS.SELECTED,
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });

        const base = new THREE.LineSegments(geometry, material);
        base.renderOrder = 999;

        const group = new THREE.Group();
        group.add(base);
        group.name = 'SelectionBox';

        return { group, base };
    }

    /**
     * Updates selection geometry size and color.
     */
    updateGeometry(selection: SelectionRefs, size: Position3D, isHovered: boolean): void {
        const { base } = selection;

        // Dispose old geometry
        base.geometry.dispose();

        // Create new geometry with updated size
        base.geometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(size.x, size.y, size.z)
        );

        // Update color based on state
        const material = base.material as THREE.LineBasicMaterial;
        material.color.setHex(isHovered ? COLORS.HOVERED : COLORS.SELECTED);
    }

    /**
     * Updates selection opacity.
     */
    setOpacity(selection: SelectionRefs, opacity: number): void {
        const material = selection.base.material as THREE.LineBasicMaterial;
        material.opacity = opacity;
    }

    /**
     * Sets selection position.
     */
    setPosition(selection: SelectionRefs, position: Position3D): void {
        selection.group.position.set(position.x, position.y, position.z);
    }

    /**
     * Adds selection to scene.
     */
    addToScene(selection: SelectionRefs, scene: THREE.Scene): void {
        if (!selection.group.parent) {
            scene.add(selection.group);
        }
    }

    /**
     * Removes selection from scene.
     */
    removeFromScene(selection: SelectionRefs): void {
        if (selection.group.parent) {
            selection.group.parent.remove(selection.group);
        }
    }

    /**
     * Disposes selection resources.
     */
    dispose(selection: SelectionRefs): void {
        this.removeFromScene(selection);
        selection.base.geometry.dispose();
        (selection.base.material as THREE.Material).dispose();
    }
}
