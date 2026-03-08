import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import SendTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

const sendTeamInvitationParametersSchema = z.object({
    email: z.string(),
    roleId: z.string().optional(),
    reason: z.string().optional()
});

@injectable()
export class SendTeamInvitationAITool extends TeamUseCaseAITool<
    z.infer<typeof sendTeamInvitationParametersSchema>,
    SendTeamInvitationUseCase,
    typeof sendTeamInvitationParametersSchema
> {
    readonly name = 'send_team_invitation';
    readonly description = 'Send a team invitation.';
    readonly parameters = sendTeamInvitationParametersSchema;

    constructor(
        @inject(SendTeamInvitationUseCase)
        useCase: SendTeamInvitationUseCase
    ) {
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                userId: scope.userId,
                email: params.email,
                roleId: params.roleId
            }),
            (output) => output
        );
    }
};
