import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class UpdateTeamRoleAITool extends AITool {
    readonly name = 'update_team_role';
    readonly description = 'Update a team role.';
    readonly parameters = z.object({ roleId: z.string(), name: z.string().optional(), permissions: z.array(z.string()).optional(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
