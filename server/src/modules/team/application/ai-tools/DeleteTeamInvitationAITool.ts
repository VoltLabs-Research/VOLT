import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import DeleteTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/DeleteTeamInvitationByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

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
    protected needsApproval = true;

    constructor(
        @inject(DeleteTeamInvitationByIdUseCase)
        useCase: DeleteTeamInvitationByIdUseCase
    ) {
        super(useCase, (params) => ({
            invitationId: params.invitationId
        }));
    }
}
