import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class CreateTeamRoleAITool extends AITool {
    readonly name = 'create_team_role';
    readonly description = 'Create a new role.';
    readonly parameters = z.object({ name: z.string(), permissions: z.array(z.string()).optional(), reason: z.string().optional() });

    constructor() {
        super();
    }
}
