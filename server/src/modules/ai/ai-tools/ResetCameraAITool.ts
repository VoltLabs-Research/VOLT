import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({});

type ResetCameraParams = z.infer<typeof parameters>;

export class ResetCameraAITool extends AITool<ResetCameraParams> {
    readonly name = 'reset_camera';
    readonly description = 'Reset the 3D viewer camera and orbit controls to the default view that frames the whole scene. '
        + 'Use this when the user is lost in the scene, has zoomed/panned too far, or asks to "reset the view" or "recenter". '
        + 'Only works while a trajectory viewer is open.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
