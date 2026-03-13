import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import DeleteTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/DeleteTeamInvitationByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

const deleteTeamInvitationParametersSchema = z.object({
    invitationId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class DeleteTeamInvitationAITool extends TeamUseCaseAITool<
    z.infer<typeof deleteTeamInvitationParametersSchema>,
    DeleteTeamInvitationByIdUseCase,
    typeof deleteTeamInvitationParametersSchema
> {
    readonly name = 'delete_team_invitation';
    readonly description = 'Cancel a pending invitation.';
    readonly parameters = deleteTeamInvitationParametersSchema;

    constructor(
        @inject(DeleteTeamInvitationByIdUseCase)
        useCase: DeleteTeamInvitationByIdUseCase
    ) {
        super(
            useCase,
            (params) => ({
                invitationId: params.invitationId
            }),
            (output) => output
        );
    }
};
