/** Domain types, defaults, and taxonomy for scene lighting. */

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
};

export interface PointLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    distance: number;
    decay: number;
    castShadow: boolean;
    helper: boolean;
};

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
};

export interface HemiLight {
    enabled: boolean;
    skyColor: string;
    groundColor: string;
    intensity: number;
    position: [number, number, number];
    helper: boolean;
};

export interface RectAreaLightCfg {
    enabled: boolean;
    color: string;
    intensity: number;
    width: number;
    height: number;
    position: [number, number, number];
    lookAt: [number, number, number];
    helper: boolean;
};

export interface LightsGlobal {
    envIntensity: number;
    envRotationYaw: number;
    envRotationPitch: number;
    envBlur: number;
};

export interface LightsState {
    global: LightsGlobal;
    directional: DirLight;
    point: PointLight;
    spot: SpotLight;
    hemisphere: HemiLight;
    rectArea: RectAreaLightCfg;
};

export interface LightsActions {
    setGlobal: (g: Partial<LightsGlobal>) => void;
    setDirectional: (d: Partial<DirLight>) => void;
    setPoint: (p: Partial<PointLight>) => void;
    setSpot: (s: Partial<SpotLight>) => void;
    setHemisphere: (h: Partial<HemiLight>) => void;
    setRectArea: (r: Partial<RectAreaLightCfg>) => void;
    reset: () => void;
};

export type LightsStore = LightsState & LightsActions;

/**
 * Scene-level lighting preset applied automatically based on scene type.
 * `Custom` is reserved for user-controlled lights configured in the editor UI.
 *
 * Note: `FractalScenePipeline` mounts two `DynamicLights` instances simultaneously —
 * one driven by `LightingPreset` (scene-driven baseline) and one by user `settings`.
 * This is intentional layering; do not collapse the two mount points without
 * confirming the product intent first.
 */
export enum LightingPreset {
    Trajectory = 'trajectory',
    Defect = 'defect',
    Custom = 'custom'
};

export const LIGHTS_DEFAULT_STATE: LightsState = {
    global: {
        envIntensity: 1,
        envRotationYaw: 0,
        envRotationPitch: 0,
        envBlur: 0
    },
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

/** Returns a fresh deep-copy of the default lights state safe for mutation. */
export const getDefaultLightsState = (): LightsState => ({
    global: { ...LIGHTS_DEFAULT_STATE.global },
    directional: {
        ...LIGHTS_DEFAULT_STATE.directional,
        position: [
            LIGHTS_DEFAULT_STATE.directional.position[0],
            LIGHTS_DEFAULT_STATE.directional.position[1],
            LIGHTS_DEFAULT_STATE.directional.position[2]
        ]
    },
    point: {
        ...LIGHTS_DEFAULT_STATE.point,
        position: [
            LIGHTS_DEFAULT_STATE.point.position[0],
            LIGHTS_DEFAULT_STATE.point.position[1],
            LIGHTS_DEFAULT_STATE.point.position[2]
        ]
    },
    spot: {
        ...LIGHTS_DEFAULT_STATE.spot,
        position: [
            LIGHTS_DEFAULT_STATE.spot.position[0],
            LIGHTS_DEFAULT_STATE.spot.position[1],
            LIGHTS_DEFAULT_STATE.spot.position[2]
        ],
        target: [
            LIGHTS_DEFAULT_STATE.spot.target[0],
            LIGHTS_DEFAULT_STATE.spot.target[1],
            LIGHTS_DEFAULT_STATE.spot.target[2]
        ]
    },
    hemisphere: {
        ...LIGHTS_DEFAULT_STATE.hemisphere,
        position: [
            LIGHTS_DEFAULT_STATE.hemisphere.position[0],
            LIGHTS_DEFAULT_STATE.hemisphere.position[1],
            LIGHTS_DEFAULT_STATE.hemisphere.position[2]
        ]
    },
    rectArea: {
        ...LIGHTS_DEFAULT_STATE.rectArea,
        position: [
            LIGHTS_DEFAULT_STATE.rectArea.position[0],
            LIGHTS_DEFAULT_STATE.rectArea.position[1],
            LIGHTS_DEFAULT_STATE.rectArea.position[2]
        ],
        lookAt: [
            LIGHTS_DEFAULT_STATE.rectArea.lookAt[0],
            LIGHTS_DEFAULT_STATE.rectArea.lookAt[1],
            LIGHTS_DEFAULT_STATE.rectArea.lookAt[2]
        ]
    }
});
