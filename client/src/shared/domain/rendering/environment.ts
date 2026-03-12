import type { RenderingOption } from '@/shared/domain/rendering/renderer';

export interface FogSettings {
    enableFog: boolean;
    fogColor: string;
    fogNear: number;
    fogFar: number;
};

export interface EnvironmentSettings extends FogSettings {
    backgroundColor: string;
};

/** @deprecated Use {@link RenderingOption} from `renderer.ts` directly. */
export type EnvironmentOption<TValue> = RenderingOption<TValue>;

/**
 * Controls what is rendered as the scene background.
 * `Color` — solid color fill (current default).
 * `Environment` — HDR environment map used as background.
 */
export enum BackgroundType {
    Color = 'color',
    Environment = 'environment'
};

/**
 * Named HDR environment presets available from the drei `<Environment>` component.
 * Values correspond to the `preset` prop accepted by drei's Environment.
 */
export enum EnvironmentPreset {
    Studio = 'studio',
    City = 'city',
    Sunset = 'sunset',
    Dawn = 'dawn',
    Night = 'night',
    Warehouse = 'warehouse',
    Forest = 'forest',
    Apartment = 'apartment',
    Park = 'park',
    Lobby = 'lobby'
};

export const BACKGROUND_TYPE_OPTIONS: EnvironmentOption<BackgroundType>[] = [
    { title: 'Color', value: BackgroundType.Color },
    { title: 'Environment', value: BackgroundType.Environment }
];

export const ENVIRONMENT_PRESET_OPTIONS: EnvironmentOption<EnvironmentPreset>[] = [
    { title: 'Studio', value: EnvironmentPreset.Studio },
    { title: 'City', value: EnvironmentPreset.City },
    { title: 'Sunset', value: EnvironmentPreset.Sunset },
    { title: 'Dawn', value: EnvironmentPreset.Dawn },
    { title: 'Night', value: EnvironmentPreset.Night },
    { title: 'Warehouse', value: EnvironmentPreset.Warehouse },
    { title: 'Forest', value: EnvironmentPreset.Forest },
    { title: 'Apartment', value: EnvironmentPreset.Apartment },
    { title: 'Park', value: EnvironmentPreset.Park },
    { title: 'Lobby', value: EnvironmentPreset.Lobby }
];

export const ENVIRONMENT_SUBSECTION_TITLES = {
    background: 'Background',
    fog: 'Fog Settings'
};

export const ENVIRONMENT_DEFAULT_SETTINGS: EnvironmentSettings = {
    backgroundColor: '#0a0a0a',
    enableFog: false,
    fogColor: '#ffffff',
    fogNear: 1,
    fogFar: 100
};

export const getDefaultEnvironmentSettings = (): EnvironmentSettings => ({
    ...ENVIRONMENT_DEFAULT_SETTINGS
});
