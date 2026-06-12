import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['play', 'pause', 'stop']).describe(
        'Playback action for the trajectory animation in the 3D viewer. '
        + '"play" starts/resumes frame animation, "pause" halts it in place, '
        + '"stop" halts animation (both pause and stop end the playback loop).'
    )
});

type ControlPlaybackParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Starts, pauses, or stops trajectory playback in the 3D
 * viewer. The browser handler (client `tools/handlers/control_playback.ts`)
 * drives the editor store's playback slice against the live canvas bridge.
 * This server class only advertises the schema; it has no server execute.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ControlPlaybackAITool extends AITool<ControlPlaybackParams> {
    readonly name = 'control_playback';
    readonly description = 'Play, pause, or stop the trajectory animation in the open 3D viewer. '
        + 'Use when the user wants to start/resume or halt frame-by-frame playback of a simulation. '
        + 'Requires an open trajectory in the viewer.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
