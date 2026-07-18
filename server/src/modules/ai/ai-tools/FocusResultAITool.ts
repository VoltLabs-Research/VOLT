import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    modifierId: z
        .string()
        .nullable()
        .describe(
            'The id of the modifier/result to focus and highlight in the UI, or null to clear the current focus. '
            + 'Resolve a real modifier id from the trajectory analysis configuration first — never invent one.'
        )
});

type FocusResultParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Focuses (or clears focus on) a specific analysis result /
 * modifier in the canvas UI so the user's attention is drawn to it. The browser
 * handler (client `tools/handlers/focus_result.ts`) drives the canvas focus
 * store. This server class only advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class FocusResultAITool extends AITool<FocusResultParams> {
    readonly name = 'focus_result';
    readonly description = 'Focus and highlight a specific analysis result / modifier in the viewer UI by its id, '
        + 'or pass null to clear the current focus. Use this to point the user at a result you are discussing.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
