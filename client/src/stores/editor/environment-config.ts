import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EnvironmentConfigStore } from '@/types/stores/editor/environment-config';
import { ENVIRONMENT_DEFAULT_CONFIG } from '@/types/stores/editor/environment-config';

const useEnvironmentConfigStore = create<EnvironmentConfigStore>()(persist((set) => ({
     ...ENVIRONMENT_DEFAULT_CONFIG,

    setBackgroundColor: (color) => {
        set({ backgroundColor: color });
    },

    setBackgroundType: (type) => {
        set({ backgroundType: type });
    },

    setEnvironmentPreset: (preset) => {
        set({ environmentPreset: preset });
    },

    setFogConfig: (config) => {
        set(state => ({ ...state, ...config }));
    },

    setToneMappingExposure: (exposure) => {
        set({ toneMappingExposure: exposure });
    },

    reset: () => {
        set(ENVIRONMENT_DEFAULT_CONFIG);
    }
}), {
    name: 'environment-config-storage',
    partialize: (state) => ({
        backgroundColor: state.backgroundColor,
        backgroundType: state.backgroundType,
        environmentPreset: state.environmentPreset,
        enableFog: state.enableFog,
        fogColor: state.fogColor,
        fogNear: state.fogNear,
        fogFar: state.fogFar,
        toneMappingExposure: state.toneMappingExposure
    })
}));

export default useEnvironmentConfigStore;