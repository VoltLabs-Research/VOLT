import type { StateCreator } from 'zustand';
import type { LightsState, LightsStore } from '@/types/stores/editor/lights-config';

export interface LightsSlice {
    lights: LightsStore;
}

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

export const createLightsSlice: StateCreator<any, [], [], LightsSlice> = (set, get) => ({
    lights: {
        ...INITIAL,
        setGlobal: (g) => set((s) => ({ lights: { ...s.lights, global: { ...s.lights.global, ...g } } })),
        setDirectional: (d) => set((s) => ({ lights: { ...s.lights, directional: { ...s.lights.directional, ...d } } })),
        setPoint: (p) => set((s) => ({ lights: { ...s.lights, point: { ...s.lights.point, ...p } } })),
        setSpot: (sp) => set((s) => ({ lights: { ...s.lights, spot: { ...s.lights.spot, ...sp } } })),
        setHemisphere: (h) => set((s) => ({ lights: { ...s.lights, hemisphere: { ...s.lights.hemisphere, ...h } } })),
        setRectArea: (r) => set((s) => ({ lights: { ...s.lights, rectArea: { ...s.lights.rectArea, ...r } } })),
        reset: () => set((s) => ({ lights: { ...s.lights, ...INITIAL } }))
    }
});
