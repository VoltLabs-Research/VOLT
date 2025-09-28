export type OrbitControlsState = {
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

export type OrbitControlsActions = {
	set: (partial: Partial<OrbitControlsState>) => void;
	setTarget: (t: [number, number, number]) => void;
	reset: () => void;
};

export type OrbitControlsStore = OrbitControlsState & OrbitControlsActions;