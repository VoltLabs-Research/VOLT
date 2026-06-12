import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['undo', 'redo', 'reset_all']).describe(
        '"undo" reverts the last view change, "redo" reapplies it, "reset_all" restores every viewer setting '
        + '(camera, lights, effects, grid, environment, point size, …) to defaults.'
    )
});

type ResetViewSettingsParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Undo/redo the last viewer change or reset all viewer settings
 * to defaults. The browser handler (`reset_view_settings.ts`) calls the editor
 * store's temporal undo/redo or `resetAll()`. This server class only advertises
 * the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ResetViewSettingsAITool extends AITool<ResetViewSettingsParams> {
    readonly name = 'reset_view_settings';
    readonly description = 'Undo or redo the last viewer change, or reset every viewer setting (camera, lights, '
        + 'effects, grid, environment, appearance) back to defaults. Use "reset_all" only when the user wants '
        + 'a clean slate.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
