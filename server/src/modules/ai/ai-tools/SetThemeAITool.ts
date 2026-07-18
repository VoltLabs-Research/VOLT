import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    theme: z.enum(['light', 'dark', 'system']).describe(
        'Theme preference to apply. "system" follows the OS color-scheme preference.'
    )
});

type SetThemeParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Sets the application theme preference. The browser handler
 * (client `tools/handlers/set_theme.ts`) persists the preference to the same
 * localStorage key the theme hook reads and updates the document theme
 * contract. This server class only advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetThemeAITool extends AITool<SetThemeParams> {
    readonly name = 'set_theme';
    readonly description = 'Switch the application appearance between light, dark, or system (OS-following) theme.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
