import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    view: z
        .enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric'])
        .describe(
            'Named camera viewpoint to snap to. front/back look along the Y axis, left/right along X, '
            + 'top/bottom along the Z (up) axis, and isometric is a 3/4 corner view. The camera always '
            + 'targets the scene origin.'
        )
});

type SetCameraViewParams = z.infer<typeof parameters>;

export class SetCameraViewAITool extends AITool<SetCameraViewParams> {
    readonly name = 'set_camera_view';
    readonly description = 'Snap the 3D viewer camera to a named viewpoint: front, back, left, right, top, bottom, or isometric. '
        + 'Use this when the user asks to "look from the top", "view from the side", "show the front", or "give me an isometric view". '
        + 'Only works while a trajectory viewer is open.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
