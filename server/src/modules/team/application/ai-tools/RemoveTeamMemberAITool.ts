import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class RemoveTeamMemberAITool extends AITool {
    readonly name = 'remove_team_member';
    readonly description = 'Remove a team member.';
    readonly parameters = z.object({ memberId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
