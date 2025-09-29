import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RendererSettingsStore, RendererSettingsState } from '@/types/stores/editor/renderer-settings';

const INITIAL: RendererSettingsState = {
    create: {
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        logarithmicDepthBuffer: false,
        preserveDrawingBuffer: false
    },
    runtime: {
        toneMapping: 'None',
        toneMappingExposure: 1,
        outputColorSpace: 'SRGB',
        physicallyCorrectLights: false,
        localClippingEnabled: false,
        autoClear: true,
        shadowEnabled: false,
        shadowType: 'Basic'
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

// Provide both named and default exports for compatibility
export { useRendererSettings };
export default useRendererSettings;

