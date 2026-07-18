import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    frame: z.number().optional().describe(
        'Exact timestep value to jump to (NOT the frame index). Must be one of the trajectory\'s '
        + 'timesteps; if it does not match exactly the viewer clamps to the nearest valid timestep. '
        + 'Use list/inspection tools to discover real timesteps when unsure.'
    ),
    position: z.enum(['first', 'last', 'next', 'previous']).optional().describe(
        'Relative jump instead of an exact timestep. "first"/"last" go to the timeline ends; '
        + '"next"/"previous" step one frame from the current timestep. Ignored if `frame` is provided.'
    )
});

type SeekFrameParams = z.infer<typeof parameters>;

export class SeekFrameAITool extends AITool<SeekFrameParams> {
    readonly name = 'seek_frame';
    readonly description = 'Jump the open 3D viewer to a specific trajectory frame by exact timestep, '
        + 'or relatively (first, last, next, previous). Use when the user wants to scrub to a particular '
        + 'point in the simulation. Requires an open trajectory in the viewer.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
