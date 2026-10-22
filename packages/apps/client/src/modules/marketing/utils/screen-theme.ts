import { Theme, storeThemePreference } from '@/shared/ui/hooks/use-theme';

// A screen shows the app at the theme the page asks for in its URL (see resolveScreenUrl).
// It is set before the app's modules load, because the viewer takes the defaults of its
// lights and grid from it as its stores are created, and stored as the preference the app's
// theme toggle reads.
export const applyScreenTheme = (search: string): void => {
    const theme = new URLSearchParams(search).get('theme') === Theme.Light ? Theme.Light : Theme.Dark;
    document.documentElement.dataset.theme = theme;
    storeThemePreference(theme);
};
