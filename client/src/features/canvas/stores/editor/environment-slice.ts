import type { StateCreator } from 'zustand';
import type { EnvironmentConfigStore } from '@/types/stores/editor/environment-config';
import { ENVIRONMENT_DEFAULT_CONFIG } from '@/types/stores/editor/environment-config';

export interface EnvironmentSlice {
    environment: EnvironmentConfigStore;
}

export const createEnvironmentSlice: StateCreator<any, [], [], EnvironmentSlice> = (set, get) => ({
    environment: {
        ...ENVIRONMENT_DEFAULT_CONFIG,
        setBackgroundColor: (color) => set((s) => ({ environment: { ...s.environment, backgroundColor: color } })),
        setBackgroundType: (type) => set((s) => ({ environment: { ...s.environment, backgroundType: type } })),
        setEnvironmentPreset: (preset) => set((s) => ({ environment: { ...s.environment, environmentPreset: preset } })),
        setFogConfig: (config) => set((s) => ({ environment: { ...s.environment, ...config } })),
        setToneMappingExposure: (exposure) => set((s) => ({ environment: { ...s.environment, toneMappingExposure: exposure } })),
        reset: () => set((s) => ({ environment: { ...s.environment, ...ENVIRONMENT_DEFAULT_CONFIG } }))
    }
});
