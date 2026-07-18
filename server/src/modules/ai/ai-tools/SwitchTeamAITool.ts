import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    teamId: z.string().describe(
        'Id of the team to switch into. Resolve a real id with global_search / list_* first — never invent it.'
    )
});

type SwitchTeamParams = z.infer<typeof parameters>;

export class SwitchTeamAITool extends AITool<SwitchTeamParams> {
    readonly name = 'switch_team';
    readonly description = 'Switch the active team context and take the user to the dashboard. '
        + 'This changes which team\'s trajectories, clusters, and data are visible. Resolve the team id with global_search / list_* first.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
    protected readonly needsApproval = true;
}
