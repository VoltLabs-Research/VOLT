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

export enum EnvironmentColorField {
    Background = 'backgroundColor',
    Fog = 'fogColor'
};

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
