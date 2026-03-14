import type { RenderingOption } from '@/shared/domain/rendering/renderer';

export interface FogSettings {
    enableFog: boolean;
    fogColor: string;
    fogColorFollowsTheme: boolean;
    fogNear: number;
    fogFar: number;
};

export interface EnvironmentSettings extends FogSettings {
    backgroundColor: string;
    backgroundColorFollowsTheme: boolean;
};

interface EnvironmentThemeDefaults {
    backgroundColor: string;
    fogColor: string;
};

/** @deprecated Use {@link RenderingOption} from `renderer.ts` directly. */
export type EnvironmentOption<TValue> = RenderingOption<TValue>;

export enum EnvironmentColorField {
    Background = 'backgroundColor',
    Fog = 'fogColor'
};

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

const DARK_ENVIRONMENT_DEFAULTS: EnvironmentThemeDefaults = {
    backgroundColor: '#070708',
    fogColor: '#171719'
};

const LIGHT_ENVIRONMENT_DEFAULTS: EnvironmentThemeDefaults = {
    backgroundColor: '#ffffff',
    fogColor: '#f5f5f7'
};

const isDarkTheme = (): boolean => {
    if (typeof document === 'undefined') {
        return true;
    }

    return document.documentElement.getAttribute('data-theme') !== 'light';
};

const getEnvironmentThemeDefaults = (darkTheme = isDarkTheme()): EnvironmentThemeDefaults => {
    if (darkTheme) {
        return DARK_ENVIRONMENT_DEFAULTS;
    }

    return LIGHT_ENVIRONMENT_DEFAULTS;
};

const createEnvironmentSettings = (darkTheme = isDarkTheme()): EnvironmentSettings => {
    const defaults = getEnvironmentThemeDefaults(darkTheme);

    return {
        backgroundColor: defaults.backgroundColor,
        backgroundColorFollowsTheme: true,
        enableFog: false,
        fogColor: defaults.fogColor,
        fogColorFollowsTheme: true,
        fogNear: 1,
        fogFar: 100
    };
};

export const ENVIRONMENT_DEFAULT_SETTINGS: EnvironmentSettings = createEnvironmentSettings();

/** Resolves a scene environment color from the explicit theme-follow flag. */
export const resolveEnvironmentColor = (
    color: string,
    followsTheme: boolean,
    field: EnvironmentColorField,
    darkTheme = isDarkTheme()
): string => {
    if (followsTheme) {
        return getEnvironmentThemeDefaults(darkTheme)[field];
    }

    return color;
};

export const getDefaultEnvironmentSettings = (darkTheme = isDarkTheme()): EnvironmentSettings => {
    return createEnvironmentSettings(darkTheme);
};
