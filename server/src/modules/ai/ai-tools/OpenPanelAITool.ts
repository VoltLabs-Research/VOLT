import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    sidebarOption: z.string().optional().describe(
        'Sidebar panel to open in the viewer editor (e.g. the appearance/camera/lights/effects panel key).'
    ),
    modifier: z.string().optional().describe(
        'Active modifier/tool key to select within the editor (e.g. a slice plane or analysis modifier).'
    )
});

type OpenPanelParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Opens an editor sidebar panel and/or selects a modifier in
 * the viewer. The browser handler (client `tools/handlers/open_panel.ts`)
 * drives the editor store's configuration slice. This server class only
 * advertises the schema to the model (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class OpenPanelAITool extends AITool<OpenPanelParams> {
    readonly name = 'open_panel';
    readonly description = 'Open a sidebar panel and/or select a modifier inside the 3D viewer editor. '
        + 'Use this to direct the user to the right controls (e.g. appearance, camera, lights) before or after explaining a change.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
