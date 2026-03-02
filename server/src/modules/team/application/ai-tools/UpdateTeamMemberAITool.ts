import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class UpdateTeamMemberAITool extends AITool {
    readonly name = 'update_team_member';
    readonly description = 'Update a team member role.';
    readonly parameters = z.object({ memberId: z.string(), roleId: z.string().optional(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
