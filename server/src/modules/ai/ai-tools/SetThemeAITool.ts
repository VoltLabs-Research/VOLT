import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    theme: z.enum(['light', 'dark', 'system']).describe(
        'Theme preference to apply. "system" follows the OS color-scheme preference.'
    )
});

type SetThemeParams = z.infer<typeof parameters>;

export class SetThemeAITool extends AITool<SetThemeParams> {
    readonly name = 'set_theme';
    readonly description = 'Switch the application appearance between light, dark, or system (OS-following) theme.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
