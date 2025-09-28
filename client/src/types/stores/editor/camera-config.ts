export interface CameraConfigState{
    fov: number;
    near: number;
    far: number;
    zoom: number;
    filmGauge: number;
    filmOffset: number;
    focus: number;
    aspect: number;
    enableAutoFocus: boolean;
    autoFocusSpeed: number;
    bokehScale: number;
    maxBlur: number;
}

export interface CameraConfigActions {
    setFov: (value: number) => void;
    setNear: (value: number) => void;
    setFar: (value: number) => void;
    setZoom: (value: number) => void;
    setFilmGauge: (value: number) => void;
    setFilmOffset: (value: number) => void;
    setFocus: (value: number) => void;
    setAspect: (value: number) => void;
    setEnableAutoFocus: (value: boolean) => void;
    setAutoFocusSpeed: (value: number) => void;
    setBokehScale: (value: number) => void;
    setMaxBlur: (value: number) => void;
    reset: () => void;
}

export type CameraConfigStore = CameraConfigState & CameraConfigActions;

export const CAMERA_ADVANCED_DEFAULT: CameraConfigState = {
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
