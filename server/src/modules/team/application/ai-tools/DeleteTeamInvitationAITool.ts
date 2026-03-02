import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class DeleteTeamInvitationAITool extends AITool {
    readonly name = 'delete_team_invitation';
    readonly description = 'Cancel a pending invitation.';
    readonly parameters = z.object({ invitationId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
