import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    surface: z.enum(['floating', 'page', 'hidden']).describe(
        'Where to put the assistant: "floating" opens the chat widget overlay, "page" navigates to the full '
        + 'AI page, "hidden" closes the floating widget.'
    )
});

type SetChatSurfaceParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Moves the assistant between the floating widget and the full
 * AI page (or hides the widget). The browser handler drives the chat-surface
 * store + React Router.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetChatSurfaceAITool extends AITool<SetChatSurfaceParams> {
    readonly name = 'set_chat_surface';
    readonly description = 'Move the assistant UI: open the floating chat widget, go to the full AI page, or hide the widget. '
        + 'Use when the user asks to "open the assistant here", "go to the chat page", or "minimize the chat".';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
