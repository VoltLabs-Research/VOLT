import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({});

type GetViewerStateParams = z.infer<typeof parameters>;

export class GetViewerStateAITool extends AITool<GetViewerStateParams> {
    readonly name = 'get_viewer_state';
    readonly description = 'Read-only snapshot of the live 3D viewer: trajectory id, current frame/timestep, '
        + 'whether playback is running and at what speed, the active scene, point-size multiplier, background '
        + 'color, whether the simulation cell is shown, and the active sidebar option. Call this first to '
        + 'understand what the user is currently viewing before adjusting the view.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
