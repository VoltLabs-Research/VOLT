import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['undo', 'redo', 'reset_all']).describe(
        '"undo" reverts the last view change, "redo" reapplies it, "reset_all" restores every viewer setting '
        + '(camera, lights, effects, grid, environment, point size, …) to defaults.'
    )
});

type ResetViewSettingsParams = z.infer<typeof parameters>;

export class ResetViewSettingsAITool extends AITool<ResetViewSettingsParams> {
    readonly name = 'reset_view_settings';
    readonly description = 'Undo or redo the last viewer change, or reset every viewer setting (camera, lights, '
        + 'effects, grid, environment, appearance) back to defaults. Use "reset_all" only when the user wants '
        + 'a clean slate.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
