import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    speed: z.number().min(0.1).max(10).optional().describe(
        'Playback speed multiplier, clamped to [0.1, 10]. 1 is the baseline rate; '
        + 'higher values advance through frames faster.'
    ),
    targetFps: z.number().optional().describe(
        'Target frames-per-second for the playback clock at 1x speed (positive number). '
        + 'The baseline default is 10 fps.'
    ),
    rangeStart: z.number().optional().describe(
        'Start boundary (timestep value) of the playback loop range. Frames before this are skipped.'
    ),
    rangeEnd: z.number().optional().describe(
        'End boundary (timestep value) of the playback loop range. Frames after this are skipped.'
    )
});

type SetPlaybackParams = z.infer<typeof parameters>;

export class SetPlaybackAITool extends AITool<SetPlaybackParams> {
    readonly name = 'set_playback';
    readonly description = 'Configure trajectory playback settings in the open 3D viewer: playback speed '
        + '(0.1-10x), target fps, and the loop range (start/end timesteps). Use when the user wants playback '
        + 'faster/slower or limited to a frame range. Requires an open trajectory in the viewer.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
