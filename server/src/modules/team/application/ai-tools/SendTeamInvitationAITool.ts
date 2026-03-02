import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class SendTeamInvitationAITool extends AITool {
    readonly name = 'send_team_invitation';
    readonly description = 'Send a team invitation.';
    readonly parameters = z.object({ email: z.string(), roleId: z.string().optional(), reason: z.string().optional() });

    constructor() {
        super();
    }
}
