export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'volt:theme';
const query = window.matchMedia('(prefers-color-scheme: dark)');

let preference: ThemePreference = readStored();

function readStored(): ThemePreference{
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
}

function resolve(pref: ThemePreference): 'light' | 'dark'{
    if(pref === 'light' || pref === 'dark') return pref;
    return query.matches ? 'dark' : 'light';
}

function apply(): void{
    // bravais scopes its design tokens under :root[data-theme]; mirror the resolved
    // scheme onto the root so the package's components resolve their colours.
    document.documentElement.dataset.theme = resolve(preference);
}

export function getThemePreference(): ThemePreference{
    return preference;
}

export function setThemePreference(pref: ThemePreference): void{
    preference = pref;
    localStorage.setItem(STORAGE_KEY, pref);
    apply();
}

/** Applies the cached preference immediately and keeps it in sync with the OS scheme. */
export function initTheme(): void{
    apply();
    query.addEventListener('change', () => {
        if(preference === 'system') apply();
    });
}
