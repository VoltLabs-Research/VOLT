import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    trajectoryId: z.string().describe(
        'Id of the trajectory to open in the 3D viewer. Resolve a real id with global_search / '
        + 'list_* first — never invent it.'
    ),
    analysisId: z.string().optional().describe(
        'Optional analysis configuration id to focus once the viewer opens (added as the ?analysis query param).'
    ),
    ownerId: z.string().optional().describe(
        'Optional collaborator/owner id to open the trajectory inside that user\'s workspace.'
    )
});

type OpenInViewerParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Opens a trajectory in the 3D viewer (canvas). The browser
 * handler (client `tools/handlers/open_in_viewer.ts`) builds the canvas route
 * from the ids and calls React Router. This server class only advertises the
 * schema to the model; it has no server execute (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class OpenInViewerAITool extends AITool<OpenInViewerParams> {
    readonly name = 'open_in_viewer';
    readonly description = 'Open a trajectory in the 3D viewer so the user can see the simulation. '
        + 'Optionally focus a specific analysis (analysisId) or open inside a collaborator\'s workspace (ownerId). '
        + 'Resolve ids with global_search / list_* first.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
