import * as THREE from 'three';
import type { SelectionRefs } from '@/types/scene';

const COLORS = {
    BORDER: 0xffffff,
    BORDER_HOVER: 0xe6e6e6,
};

export const makeSelectionGroup = (): SelectionRefs => {
    const baseGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const baseMaterial = new THREE.LineBasicMaterial({
        color: COLORS.BORDER,
        transparent: true,
        opacity: 0.75,
        linewidth: 1
    });

    const base = new THREE.LineSegments(baseGeometry, baseMaterial);
    const group = new THREE.Group();

    group.renderOrder = 9999;
    base.renderOrder = 9999;
    group.add(base);

    return { group, base };
};

export const updateSelectionGeometry = (selection: SelectionRefs, size: THREE.Vector3, hover: boolean) => {
    selection.base.geometry.dispose();
    selection.base.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));

    const material = selection.base.material as THREE.LineBasicMaterial;
    material.color = new THREE.Color(hover ? COLORS.BORDER_HOVER : COLORS.BORDER);
    material.opacity = hover ? 0.9 : 0.75;    
};