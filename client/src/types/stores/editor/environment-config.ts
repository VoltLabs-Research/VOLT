export interface FogConfig{
    enableFog: boolean;
    fogColor: string;
    fogNear: number;
    fogFar: number;
}

export interface EnvironmentConfigState extends FogConfig{
    backgroundColor: string;
    backgroundType: 'color' | 'environment';
    environmentPreset: string;
    toneMappingExposure: number;
}

export interface EnvironmentConfigActions{
    setBackgroundColor: (color: string) => void;
    setBackgroundType: (type: 'color' | 'environment') => void;
    setEnvironmentPreset: (preset: string) => void;
    setFogConfig: (config: Partial<FogConfig>) => void;
    setToneMappingExposure: (exposure: number) => void;
    reset: () => void;
}

export type EnvironmentConfigStore = EnvironmentConfigState & EnvironmentConfigActions;

export const ENVIRONMENT_DEFAULT_CONFIG: EnvironmentConfigState = {
    backgroundColor: '#1a1a1a',
    backgroundType: 'color',
    environmentPreset: 'studio',
    enableFog: false,
    fogColor: '#ffffff',
    fogNear: 1,
    fogFar: 100,
    toneMappingExposure: 5
};
