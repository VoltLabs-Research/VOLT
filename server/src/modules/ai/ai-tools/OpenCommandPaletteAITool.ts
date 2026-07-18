import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['open', 'close', 'toggle']).describe(
        'What to do with the command palette: open it, close it, or toggle its visibility.'
    )
});

type OpenCommandPaletteParams = z.infer<typeof parameters>;

export class OpenCommandPaletteAITool extends AITool<OpenCommandPaletteParams> {
    readonly name = 'open_command_palette';
    readonly description = 'Open, close, or toggle the command palette so the user can quickly search and run commands.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
