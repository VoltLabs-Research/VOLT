import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrbitControlsState, OrbitControlsStore } from '@/types/stores/editor/orbit-controls';

const INITIAL: OrbitControlsState = {
	enabled: true,
	enableDamping: true,
	dampingFactor: 0.12,
	enableZoom: true,
	zoomSpeed: 1.1,
	enableRotate: true,
	rotateSpeed: 0.9,
	enablePan: true,
	panSpeed: 0.9,
	screenSpacePanning: true,
	autoRotate: false,
	autoRotateSpeed: 2.0,
	minDistance: 2,
	maxDistance: 10000,
	minPolarAngle: 0,
	maxPolarAngle: Math.PI,
	minAzimuthAngle: -Infinity,
	maxAzimuthAngle: Infinity,
	target: [0, 2, 0]
};

const useOrbitControlsSettings = create<OrbitControlsStore>()(
	persist(
		(set) => ({
      ...INITIAL,
			set: (partial) => set((s) => ({ ...s, ...partial })),
			setTarget: (t) => set(() => ({ target: t })),
			reset: () => set(() => INITIAL)
		}),
		{
			name: 'orbit-controls-settings',
			partialize: (s) => ({
				enabled: s.enabled,
				enableDamping: s.enableDamping,
				dampingFactor: s.dampingFactor,
				enableZoom: s.enableZoom,
				zoomSpeed: s.zoomSpeed,
				enableRotate: s.enableRotate,
				rotateSpeed: s.rotateSpeed,
				enablePan: s.enablePan,
				panSpeed: s.panSpeed,
				screenSpacePanning: s.screenSpacePanning,
				autoRotate: s.autoRotate,
				autoRotateSpeed: s.autoRotateSpeed,
				minDistance: s.minDistance,
				maxDistance: s.maxDistance,
				minPolarAngle: s.minPolarAngle,
				maxPolarAngle: s.maxPolarAngle,
				minAzimuthAngle: s.minAzimuthAngle,
				maxAzimuthAngle: s.maxAzimuthAngle,
				target: s.target
			})
		}
	)
);

export default useOrbitControlsSettings;
