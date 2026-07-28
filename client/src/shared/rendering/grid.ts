export interface GridThemeDefaults {
    sectionColor: string;
    cellColor: string;
};

const DARK_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#262626',
    cellColor: '#161616'
};

const LIGHT_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#d1d1d6',
    cellColor: '#e5e5ea'
};

export const getGridThemeDefaults = (darkTheme: boolean): GridThemeDefaults => {
    if (darkTheme) {
        return DARK_GRID_DEFAULTS;
    }

    return LIGHT_GRID_DEFAULTS;
};
