import type { StateCreator } from 'zustand';
import type { OrbitControlsState, OrbitControlsStore } from '@/types/stores/editor/orbit-controls';

export interface OrbitControlsSlice {
    orbitControls: OrbitControlsStore;
}

const INITIAL: OrbitControlsState = {
    enabled: true,
    enableDamping: true,
    dampingFactor: 0.05,
    enableZoom: true,
    zoomSpeed: 0.8,
    enableRotate: true,
    rotateSpeed: 0.5,
    enablePan: true,
    panSpeed: 0.6,
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

export const createOrbitControlsSlice: StateCreator<any, [], [], OrbitControlsSlice> = (set, get) => ({
    orbitControls: {
        ...INITIAL,
        set: (partial) => set((s: any) => ({ orbitControls: { ...s.orbitControls, ...partial } })),
        setTarget: (t) => set((s: any) => ({ orbitControls: { ...s.orbitControls, target: t } })),
        reset: () => set((s: any) => ({ orbitControls: { ...s.orbitControls, ...INITIAL } }))
    }
});
