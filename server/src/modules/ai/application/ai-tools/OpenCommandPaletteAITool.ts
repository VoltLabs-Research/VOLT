import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['open', 'close', 'toggle']).describe(
        'What to do with the command palette: open it, close it, or toggle its visibility.'
    )
});

type OpenCommandPaletteParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Opens, closes, or toggles the command palette. The browser
 * handler (client `tools/handlers/open_command_palette.ts`) drives the command
 * palette store. This server class only advertises the schema to the model
 * (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class OpenCommandPaletteAITool extends AITool<OpenCommandPaletteParams> {
    readonly name = 'open_command_palette';
    readonly description = 'Open, close, or toggle the command palette so the user can quickly search and run commands.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
