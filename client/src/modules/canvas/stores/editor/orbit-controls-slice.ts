import { resetSectionState, setSectionFieldState, mergeSectionState } from './store-section';

import type { EditorStore } from './types';
import type { OrbitControlsState, OrbitControlsStore } from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface OrbitControlsSlice {
    orbitControls: OrbitControlsStore;
};

const INITIAL: OrbitControlsState = {
    enabled: true,
    enableDamping: true,
    dampingFactor: 0.08,
    enableZoom: true,
    zoomSpeed: 1.0,
    enableRotate: true,
    rotateSpeed: 0.8,
    enablePan: true,
    panSpeed: 0.8,
    screenSpacePanning: true,
    autoRotate: false,
    autoRotateSpeed: 1.0,
    minDistance: 2,
    maxDistance: 10000,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minAzimuthAngle: -Math.PI * 1000,
    maxAzimuthAngle: Math.PI * 1000,
    target: [0, 2, 0]
};

export const createOrbitControlsSlice: StateCreator<EditorStore, [], [], OrbitControlsSlice> = (set) => ({
    orbitControls: {
        ...INITIAL,
        set: (partial: Partial<OrbitControlsState>) => set((state) => mergeSectionState(state, 'orbitControls', partial)),
        setTarget: (t: [number, number, number]) => set((state) => setSectionFieldState(state, 'orbitControls', 'target', t)),
        reset: () => set((state) => resetSectionState(state, 'orbitControls', INITIAL))
    }
});
