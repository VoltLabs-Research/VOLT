import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class DeleteTeamRoleAITool extends AITool {
    readonly name = 'delete_team_role';
    readonly description = 'Delete a team role.';
    readonly parameters = z.object({ roleId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
