import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    layer: z.string().describe(
        'Which scene layer to toggle. Use "atoms" (a.k.a. "particles"/"trajectory"/"default") for the base '
        + 'atomistic point cloud — the only layer that can be safely added/removed without analysis context. '
        + 'Other layers (plugin analysis overlays, color-coding, filters, line styles) are managed elsewhere '
        + 'and are not addressable here.'
    ),
    visible: z.boolean().describe('true to show the layer, false to hide it.')
});

type SetVisibleLayersParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Shows or hides a scene layer in the 3D viewer. The browser
 * handler (`set_visible_layers.ts`) maps a friendly layer name to add/remove of
 * the corresponding scene object on the editor store. Only the base atomistic
 * layer (the `DefaultScene`) is safely constructible from a name; analysis-derived
 * layers (plugin/color-coding/filter/line-style) carry ids the model cannot
 * fabricate and are intentionally out of scope here. This server class only
 * advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetVisibleLayersAITool extends AITool<SetVisibleLayersParams> {
    readonly name = 'set_visible_layers';
    readonly description = 'Show or hide a scene layer in the 3D viewer. Currently supports the base atomistic '
        + 'point-cloud layer ("atoms"). Analysis overlays (plugin results, color-coding, filters, line styles) '
        + 'are configured from their own panels and are not toggled here.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
