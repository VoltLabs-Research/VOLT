import { Theme, resolveEffectiveTheme } from '@/shared/ui/hooks/use-theme';
import { writeStoredString } from '@/shared/utils/local-storage';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetThemeInput } from '@volt/contracts/modules/ai/ai-tools';

const THEME_STORAGE_KEY = 'theme';

const setTheme: ClientToolHandler<SetThemeInput> = {
    name: 'set_theme',

    run(input): ClientToolResult {
        const preference = input.theme as Theme;

        writeStoredString(THEME_STORAGE_KEY, preference);

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
