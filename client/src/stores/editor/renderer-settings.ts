import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RendererSettingsStore, RendererSettingsState } from '@/types/stores/editor/renderer-settings';

const INITIAL: RendererSettingsState = {
	create: {
		antialias: true,
		alpha: true,
		depth: true,
		stencil: false,
		logarithmicDepthBuffer: false,
		preserveDrawingBuffer: false
	},
	runtime: {
		toneMapping: 'ACESFilmic',
		toneMappingExposure: 5,
		outputColorSpace: 'SRGB',
		physicallyCorrectLights: true,
		localClippingEnabled: false,
		autoClear: true,
		shadowEnabled: true,
		shadowType: 'PCFSoft'
	}
};

const useRendererSettings = create<RendererSettingsStore>()(
	persist(
		(set) => ({
			...INITIAL,
			setCreate: (partial) => set((s) => ({ create: { ...s.create, ...partial } })),
			setRuntime: (partial) => set((s) => ({ runtime: { ...s.runtime, ...partial } })),
			reset: () => set(() => INITIAL)
		}),
		{
			name: 'renderer-settings',
			partialize: (s) => ({
				create: s.create,
				runtime: s.runtime
			})
		}
	)
);

export default useRendererSettings;
