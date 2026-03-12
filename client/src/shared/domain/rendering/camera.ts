export interface CameraOption<TValue> {
    value: TValue;
    title: string;
};

export interface PerspectiveCameraSettings {
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
};

export interface OrthographicCameraSettings {
    near: number;
    far: number;
    zoom: number;
};

export interface CameraSettings {
    type: CameraType;
    position: [number, number, number];
    up: [number, number, number];
    perspective: PerspectiveCameraSettings;
    orthographic: OrthographicCameraSettings;
};

export interface OrbitControlsSettings {
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    target: [number, number, number];
};

export enum CameraType {
    Perspective = 'perspective',
    Orthographic = 'orthographic'
};

export const CAMERA_TYPE_OPTIONS: CameraOption<CameraType>[] = [
    { title: 'Perspective', value: CameraType.Perspective },
    { title: 'Orthographic', value: CameraType.Orthographic }
];

export const CAMERA_SUBSECTION_TITLES = {
    projection: 'Projection',
    perspective: 'Perspective',
    orthographic: 'Orthographic',
    position: 'Position',
    transform: 'Transform'
};

export const PERSPECTIVE_DEFAULTS: PerspectiveCameraSettings = {
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

export const ORTHOGRAPHIC_DEFAULTS: OrthographicCameraSettings = {
    near: 0.1,
    far: 1000,
    zoom: 1
};

export const CAMERA_DEFAULTS: CameraSettings = {
    type: CameraType.Perspective,
    position: [8, 8, 6],
    up: [0, 0, 1],
    perspective: PERSPECTIVE_DEFAULTS,
    orthographic: ORTHOGRAPHIC_DEFAULTS
};

export const ORBIT_CONTROLS_DEFAULT_SETTINGS: OrbitControlsSettings = {
    enabled: true,
    enableDamping: true,
    dampingFactor: 0.08,
    enableZoom: true,
    zoomSpeed: 1.0,
    enableRotate: true,
    rotateSpeed: 0.8,
    enablePan: true,
    panSpeed: 0.8,
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

export const getDefaultPerspectiveCameraSettings = (): PerspectiveCameraSettings => ({
    ...PERSPECTIVE_DEFAULTS
});

export const getDefaultOrthographicCameraSettings = (): OrthographicCameraSettings => ({
    ...ORTHOGRAPHIC_DEFAULTS
});

export const getDefaultCameraSettings = (): CameraSettings => ({
    ...CAMERA_DEFAULTS,
    position: [
        CAMERA_DEFAULTS.position[0],
        CAMERA_DEFAULTS.position[1],
        CAMERA_DEFAULTS.position[2]
    ],
    up: [
        CAMERA_DEFAULTS.up[0],
        CAMERA_DEFAULTS.up[1],
        CAMERA_DEFAULTS.up[2]
    ],
    perspective: getDefaultPerspectiveCameraSettings(),
    orthographic: getDefaultOrthographicCameraSettings()
});

export const getDefaultOrbitControlsSettings = (): OrbitControlsSettings => ({
    ...ORBIT_CONTROLS_DEFAULT_SETTINGS,
    target: [
        ORBIT_CONTROLS_DEFAULT_SETTINGS.target[0],
        ORBIT_CONTROLS_DEFAULT_SETTINGS.target[1],
        ORBIT_CONTROLS_DEFAULT_SETTINGS.target[2]
    ]
});

/** Checks whether a runtime string matches a supported camera type. */
export const isCameraType = (value: string): value is CameraType => {
    return CAMERA_TYPE_OPTIONS.some((option) => option.value === value);
};
