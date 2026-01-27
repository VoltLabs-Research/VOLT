import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DirLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
    shadowBias: number;
    shadowNormalBias: number;
    camLeft: number;
    camRight: number;
    camTop: number;
    camBottom: number;
    camNear: number;
    camFar: number;
    helper: boolean;
}

export interface PointLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    distance: number;
    decay: number;
    castShadow: boolean;
    helper: boolean;
}

export interface SpotLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    target: [number, number, number];
    distance: number;
    angle: number;
    penumbra: number;
    decay: number;
    castShadow: boolean;
    helper: boolean;
}

export interface HemiLight {
    enabled: boolean;
    skyColor: string;
    groundColor: string;
    intensity: number;
    position: [number, number, number];
    helper: boolean;
}

export interface RectAreaLightCfg {
    enabled: boolean;
    color: string;
    intensity: number;
    width: number;
    height: number;
    position: [number, number, number];
    lookAt: [number, number, number];
    helper: boolean;
}

export interface LightsGlobal {
    envIntensity: number;
    envRotationYaw: number;
    envRotationPitch: number;
    envBlur: number;
}

export interface LightsState {
    global: LightsGlobal;
    directional: DirLight;
    point: PointLight;
    spot: SpotLight;
    hemisphere: HemiLight;
    rectArea: RectAreaLightCfg;
}

export interface LightsActions {
    setGlobal: (g: Partial<LightsGlobal>) => void;
    setDirectional: (d: Partial<DirLight>) => void;
    setPoint: (p: Partial<PointLight>) => void;
    setSpot: (s: Partial<SpotLight>) => void;
    setHemisphere: (h: Partial<HemiLight>) => void;
    setRectArea: (r: Partial<RectAreaLightCfg>) => void;
    reset: () => void;
}

export type LightsStore = LightsState & LightsActions;

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
