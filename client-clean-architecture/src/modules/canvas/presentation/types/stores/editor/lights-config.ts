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
}

export type LightsStore = LightsState & LightsActions;
