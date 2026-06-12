import { Theme } from '@/shared/presentation/hooks/use-theme';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface SetThemeInput {
    theme?: 'light' | 'dark' | 'system';
}

const THEME_STORAGE_KEY = 'theme';
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const VALID_THEMES: readonly Theme[] = [Theme.Light, Theme.Dark, Theme.System];

/** Resolves a theme preference into the concrete theme to apply on the document. */
const resolveEffectiveTheme = (preference: Theme): Theme => {
    if (preference === Theme.System) {
        return window.matchMedia(THEME_MEDIA_QUERY).matches ? Theme.Dark : Theme.Light;
    }
    return preference;
};

/**
 * Sets the application theme preference. Mirrors the non-React path used by
 * `useTheme`: persists the preference to the `theme` localStorage key and writes
 * the resolved theme to the document's `data-theme` contract attribute (observed
 * by `subscribeToAppTheme` / `getActiveAppTheme`). React `useTheme` consumers
 * pick up the persisted value on next read/mount.
 */
const setTheme: ClientToolHandler<SetThemeInput> = {
    name: 'set_theme',

    run(input): ClientToolResult {
        const requested = input.theme;
        const preference = VALID_THEMES.find((theme) => theme === requested);

        if (!preference) {
            return {
                ok: false,
                summary: 'Could not change the theme.',
                reason: 'invalid_theme',
                hint: 'theme must be one of: light, dark, system.'
            };
        }

        localStorage.setItem(THEME_STORAGE_KEY, preference);

        const effective = resolveEffectiveTheme(preference);
        document.documentElement.setAttribute('data-theme', effective);

        return {
            ok: true,
            summary: preference === Theme.System
                ? `Theme set to system (currently ${effective}).`
                : `Theme set to ${effective}.`,
            data: { preference, effective }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Theme unchanged', icon: 'theme' };
        }
        const data = result.data as { preference?: string; effective?: string } | undefined;
        return { label: `Theme set to ${data?.preference ?? 'theme'}`, icon: 'theme' };
    }
};

export default setTheme;
