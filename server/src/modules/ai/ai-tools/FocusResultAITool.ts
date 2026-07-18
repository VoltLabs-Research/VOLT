import { AITool } from '@shared/application/ai/AITool';
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

export class FocusResultAITool extends AITool<FocusResultParams> {
    readonly name = 'focus_result';
    readonly description = 'Focus and highlight a specific analysis result / modifier in the viewer UI by its id, '
        + 'or pass null to clear the current focus. Use this to point the user at a result you are discussing.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
