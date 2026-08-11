

interface LightsThemeDefaults {
    directionalColor: string;
    pointColor: string;
    spotColor: string;
    hemisphereSkyColor: string;
    hemisphereGroundColor: string;
    rectAreaColor: string;
};

export interface DirLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
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

interface LightsActions {
    setGlobal: (g: Partial<LightsGlobal>) => void;
    setDirectional: (d: Partial<DirLight>) => void;
    setPoint: (p: Partial<PointLight>) => void;
    setSpot: (s: Partial<SpotLight>) => void;
    setHemisphere: (h: Partial<HemiLight>) => void;
    setRectArea: (r: Partial<RectAreaLightCfg>) => void;
    reset: () => void;
};

export type LightsStore = LightsState & LightsActions;

export enum LightingPreset {
    Trajectory = 'trajectory',
    Defect = 'defect',
    Custom = 'custom'
};

const DARK_LIGHTS_DEFAULTS: LightsThemeDefaults = {
    directionalColor: '#f0f0f0',
    pointColor: '#f0f0f0',
    spotColor: '#f0f0f0',
    hemisphereSkyColor: '#64d2ff',
    hemisphereGroundColor: '#1D1D20',
    rectAreaColor: '#f0f0f0'
};

const LIGHT_LIGHTS_DEFAULTS: LightsThemeDefaults = {
    directionalColor: '#1d1d1f',
    pointColor: '#1d1d1f',
    spotColor: '#1d1d1f',
    hemisphereSkyColor: '#5ac8fa',
    hemisphereGroundColor: '#d1d1d6',
    rectAreaColor: '#1d1d1f'
};

const isDarkTheme = (): boolean => {
    return document.documentElement.getAttribute('data-theme') !== 'light';
};

const getLightsThemeDefaults = (darkTheme = isDarkTheme()): LightsThemeDefaults => {
    if (darkTheme) {
        return DARK_LIGHTS_DEFAULTS;
    }

    return LIGHT_LIGHTS_DEFAULTS;
};

const createLightsState = (darkTheme = isDarkTheme()): LightsState => {
    const defaults = getLightsThemeDefaults(darkTheme);

    return {
        global: {
            envIntensity: 1,
            envRotationYaw: 0,
            envRotationPitch: 0,
            envBlur: 0
        },
        directional: {
            enabled: true,
            color: defaults.directionalColor,
            intensity: 2,
            position: [10, 10, 10],
            castShadow: true,
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
            color: defaults.pointColor,
            intensity: 2,
            position: [-10, 10, -10],
            distance: 0,
            decay: 2,
            castShadow: false,
            helper: false
        },
        spot: {
            enabled: false,
            color: defaults.spotColor,
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
            skyColor: defaults.hemisphereSkyColor,
            groundColor: defaults.hemisphereGroundColor,
            intensity: 0.6,
            position: [0, 0, 50],
            helper: false
        },
        rectArea: {
            enabled: false,
            color: defaults.rectAreaColor,
            intensity: 50,
            width: 5,
            height: 3,
            position: [5, 5, 5],
            lookAt: [0, 0, 0],
            helper: false
        }
    };
};

export const getDefaultLightsState = (darkTheme = isDarkTheme()): LightsState => {
    const defaultState = createLightsState(darkTheme);

    return {
        global: { ...defaultState.global },
        directional: {
            ...defaultState.directional,
            position: [
                defaultState.directional.position[0],
                defaultState.directional.position[1],
                defaultState.directional.position[2]
            ]
        },
        point: {
            ...defaultState.point,
            position: [
                defaultState.point.position[0],
                defaultState.point.position[1],
                defaultState.point.position[2]
            ]
        },
        spot: {
            ...defaultState.spot,
            position: [
                defaultState.spot.position[0],
                defaultState.spot.position[1],
                defaultState.spot.position[2]
            ],
            target: [
                defaultState.spot.target[0],
                defaultState.spot.target[1],
                defaultState.spot.target[2]
            ]
        },
        hemisphere: {
            ...defaultState.hemisphere,
            position: [
                defaultState.hemisphere.position[0],
                defaultState.hemisphere.position[1],
                defaultState.hemisphere.position[2]
            ]
        },
        rectArea: {
            ...defaultState.rectArea,
            position: [
                defaultState.rectArea.position[0],
                defaultState.rectArea.position[1],
                defaultState.rectArea.position[2]
            ],
            lookAt: [
                defaultState.rectArea.lookAt[0],
                defaultState.rectArea.lookAt[1],
                defaultState.rectArea.lookAt[2]
            ]
        }
    };
};
