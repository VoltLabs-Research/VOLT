import type { StateCreator } from 'zustand';
import type { EnvironmentConfigStore } from '@/types/stores/editor/environment-config';
import { ENVIRONMENT_DEFAULT_CONFIG } from '@/types/stores/editor/environment-config';

export interface EnvironmentSlice {
    environment: EnvironmentConfigStore;
}

export const createEnvironmentSlice: StateCreator<any, [], [], EnvironmentSlice> = (set, get) => ({
    environment: {
        ...ENVIRONMENT_DEFAULT_CONFIG,
        setBackgroundColor: (color) => set((s: any) => ({ environment: { ...s.environment, backgroundColor: color } })),
        setBackgroundType: (type) => set((s: any) => ({ environment: { ...s.environment, backgroundType: type } })),
        setEnvironmentPreset: (preset) => set((s: any) => ({ environment: { ...s.environment, environmentPreset: preset } })),
        setFogConfig: (config) => set((s: any) => ({ environment: { ...s.environment, ...config } })),
        setToneMappingExposure: (exposure) => set((s: any) => ({ environment: { ...s.environment, toneMappingExposure: exposure } })),
        reset: () => set((s: any) => ({ environment: { ...s.environment, ...ENVIRONMENT_DEFAULT_CONFIG } }))
    }
});
