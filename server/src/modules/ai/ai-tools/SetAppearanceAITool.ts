import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    pointSize: z.number().min(0.1).max(5).optional().describe(
        'Point-size multiplier for the atomistic point cloud (0.1–5.0, default 1.0). Larger = bigger atoms.'
    ),
    showSimulationCell: z.boolean().optional().describe('Whether to render the simulation cell bounding box.'),
    quality: z.enum(['ultra', 'high', 'balanced', 'performance', 'battery']).optional().describe(
        'Render-quality preset. "ultra"/"high" favor visual fidelity, "performance"/"battery" favor framerate.'
    )
});

type SetAppearanceParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Adjusts viewer appearance: point size, simulation-cell
 * visibility, and the render-quality preset. The browser handler
 * (`set_appearance.ts`) calls the editor store (`setPointSizeMultiplier`,
 * `setShowSimulationCell`, `performanceSettings.setPreset`). This server class
 * only advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetAppearanceAITool extends AITool<SetAppearanceParams> {
    readonly name = 'set_appearance';
    readonly description = 'Adjust how the 3D viewer looks: point/atom size, whether the simulation cell box is '
        + 'shown, and the render-quality preset (ultra/high/balanced/performance/battery). Provide only the '
        + 'fields you want to change.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
