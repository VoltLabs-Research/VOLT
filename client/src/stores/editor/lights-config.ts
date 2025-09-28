import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LightsState, LightsStore } from '@/types/stores/editor/lights-config';

const INITIAL: LightsState = {
    global: { envIntensity: 1, envRotationYaw: 0, envRotationPitch: 0, envBlur: 0 },
    directional: {
        enabled: true,
        color: '#ffffff',
        intensity: 2,
        position: [10, 10, 10],
        castShadow: true,
        shadowBias: -0.0005,
        shadowNormalBias: 0.02,
        camLeft: -20,
        camRight: 20,
        camTop: 20,
        camBottom: -20,
        camNear: 0.5,
        camFar: 200,
        helper: false
    },
    point: {
        enabled: false,
        color: '#ffffff',
        intensity: 2,
        position: [-10, 10, -10],
        distance: 0,
        decay: 2,
        castShadow: false,
        helper: false
    },
    spot: {
        enabled: false,
        color: '#ffffff',
        intensity: 3,
        position: [15, 15, 15],
        target: [0, 0, 0],
        distance: 0,
        angle: Math.PI / 6,
        penumbra: 0.3,
        decay: 2,
        castShadow: false,
        helper: false
    },
    hemisphere: {
        enabled: false,
        skyColor: '#88bbff',
        groundColor: '#444444',
        intensity: 0.6,
        position: [0, 0, 50],
        helper: false
    },
    rectArea: {
        enabled: false,
        color: '#ffffff',
        intensity: 50,
        width: 5,
        height: 3,
        position: [5, 5, 5],
        lookAt: [0, 0, 0],
        helper: false
    }
};

const useLightsStore = create<LightsStore>()(persist((set) => ({
    ...INITIAL,
    setGlobal: (g) => set((s) => ({ global: { ...s.global, ...g } })),
    setDirectional: (d) => set((s) => ({ directional: { ...s.directional, ...d } })),
    setPoint: (p) => set((s) => ({ point: { ...s.point, ...p } })),
    setSpot: (sp) => set((s) => ({ spot: { ...s.spot, ...sp } })),
    setHemisphere: (h) => set((s) => ({ hemisphere: { ...s.hemisphere, ...h } })),
    setRectArea: (r) => set((s) => ({ rectArea: { ...s.rectArea, ...r } })),
    reset: () => set(() => INITIAL)
}), {
    name: 'lights-config-storage',
    partialize: (s) => s
}));

export default useLightsStore;
