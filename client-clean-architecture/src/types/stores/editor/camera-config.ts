export type CameraType = 'perspective' | 'orthographic';

export interface PerspectiveSettings {
    fov: number;
    near: number;
    far: number;
    zoom: number;
    focus: number;
    filmGauge: number;
    filmOffset: number;
    aspect: number;
    enableAutoFocus: boolean;
    autoFocusSpeed: number;
    bokehScale: number;
    maxBlur: number;
}

export interface OrthographicSettings {
    near: number;
    far: number;
    zoom: number;
}

export interface CameraSettingsState {
    type: CameraType;
    position: [number, number, number];
    up: [number, number, number];
    perspective: PerspectiveSettings;
    orthographic: OrthographicSettings;
}

export interface CameraSettingsActions {
    setType: (type: CameraType) => void;
    setPosition: (position: [number, number, number]) => void;
    setUp: (up: [number, number, number]) => void;
    setPerspective: (partial: Partial<PerspectiveSettings>) => void;
    setOrthographic: (partial: Partial<OrthographicSettings>) => void;
    setCamera: (partial: Partial<CameraSettingsState> & {
        perspective?: Partial<PerspectiveSettings>;
        orthographic?: Partial<OrthographicSettings>;
    }) => void;
    reset: () => void;
}

export type CameraSettingsStore = CameraSettingsState & CameraSettingsActions;

export const PERSPECTIVE_DEFAULT: PerspectiveSettings = {
    fov: 50,
    near: 0.01,
    far: 200,
    zoom: 1,
    filmGauge: 35,
    filmOffset: 0,
    focus: 5,
    aspect: 1,
    enableAutoFocus: false,
    autoFocusSpeed: 0.1,
    bokehScale: 1,
    maxBlur: 0.01
};

export const ORTHOGRAPHIC_DEFAULT: OrthographicSettings = {
    near: 0.1,
    far: 1000,
    zoom: 1
};
