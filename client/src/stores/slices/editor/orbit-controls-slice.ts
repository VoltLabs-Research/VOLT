import type { StateCreator } from 'zustand';
import type { OrbitControlsState, OrbitControlsStore } from '@/types/stores/editor/orbit-controls';

export interface OrbitControlsSlice {
    orbitControls: OrbitControlsStore;
}

const INITIAL: OrbitControlsState = {
    enabled: true,
    enableDamping: true,
    dampingFactor: 0.12,
    enableZoom: true,
    zoomSpeed: 1.1,
    enableRotate: true,
    rotateSpeed: 0.9,
    enablePan: true,
    panSpeed: 0.9,
    screenSpacePanning: true,
    autoRotate: false,
    autoRotateSpeed: 2.0,
    minDistance: 2,
    maxDistance: 10000,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
    target: [0, 2, 0]
};

export const createOrbitControlsSlice: StateCreator<any, [], [], OrbitControlsSlice> = (set, get) => ({
    orbitControls: {
        ...INITIAL,
        set: (partial) => set((s) => ({ orbitControls: { ...s.orbitControls, ...partial } })),
        setTarget: (t) => set((s) => ({ orbitControls: { ...s.orbitControls, target: t } })),
        reset: () => set((s) => ({ orbitControls: { ...s.orbitControls, ...INITIAL } }))
    }
});
