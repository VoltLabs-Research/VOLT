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

export function initTheme(): void{
    apply();
    query.addEventListener('change', () => {
        if(preference === 'system') apply();
    });
}

export function getResolvedTheme(): 'light' | 'dark'{
    return resolve(preference);
}

export function subscribeToThemeChange(listener: () => void): () => void{
    const onChange = (): void => {
        if(preference === 'system') listener();
    };

    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
}
