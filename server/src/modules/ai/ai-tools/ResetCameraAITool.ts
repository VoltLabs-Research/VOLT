import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({});

type ResetCameraParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Resets the 3D viewer camera and orbit controls back to their
 * default framing of the scene. The browser handler (client
 * `tools/handlers/reset_camera.ts`) calls the mounted FractalScene's imperative
 * reset handle and, as a fallback, the editor store camera/orbit-controls reset
 * actions. This server class only advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ResetCameraAITool extends AITool<ResetCameraParams> {
    readonly name = 'reset_camera';
    readonly description = 'Reset the 3D viewer camera and orbit controls to the default view that frames the whole scene. '
        + 'Use this when the user is lost in the scene, has zoomed/panned too far, or asks to "reset the view" or "recenter". '
        + 'Only works while a trajectory viewer is open.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
