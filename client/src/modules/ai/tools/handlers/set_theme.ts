import { Theme } from '@/shared/ui/hooks/use-theme';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetThemeInput } from '@volt/contracts/modules/ai/ai-tools';

const THEME_STORAGE_KEY = 'theme';
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const resolveEffectiveTheme = (preference: Theme): Theme => {
    if (preference === Theme.System) {
        return window.matchMedia(THEME_MEDIA_QUERY).matches ? Theme.Dark : Theme.Light;
    }
    return preference;
};

const setTheme: ClientToolHandler<SetThemeInput> = {
    name: 'set_theme',

    run(input): ClientToolResult {
        const preference = input.theme as Theme;

        localStorage.setItem(THEME_STORAGE_KEY, preference);

        const effective = resolveEffectiveTheme(preference);
        document.documentElement.setAttribute('data-theme', effective);

        return {
            ok: true,
            summary: preference === Theme.System
                ? `Theme set to system (currently ${effective}).`
                : `Theme set to ${effective}.`,
            data: {
                preference,
                effective
            }
        };
    },

    describeEffect(input) {
        return {
            label: `Theme set to ${input.theme}`,
            icon: 'theme'
        };
    }
};

export default setTheme;
