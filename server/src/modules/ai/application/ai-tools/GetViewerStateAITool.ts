import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({});

type GetViewerStateParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED, READ-ONLY. Returns a snapshot of what the user is currently
 * looking at in the 3D viewer (trajectory id, current frame, playback state,
 * active scene, point size, background color, simulation-cell visibility, the
 * active sidebar option). The browser handler (`get_viewer_state.ts`) reads the
 * canvas bridge + editor store; it mutates nothing. This server class only
 * advertises the schema (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetViewerStateAITool extends AITool<GetViewerStateParams> {
    readonly name = 'get_viewer_state';
    readonly description = 'Read-only snapshot of the live 3D viewer: trajectory id, current frame/timestep, '
        + 'whether playback is running and at what speed, the active scene, point-size multiplier, background '
        + 'color, whether the simulation cell is shown, and the active sidebar option. Call this first to '
        + 'understand what the user is currently viewing before adjusting the view.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
