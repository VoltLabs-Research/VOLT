import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import DeleteTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const removeTeamMemberParametersSchema = z.object({
    memberId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class RemoveTeamMemberAITool extends TeamUseCaseAITool<
    z.infer<typeof removeTeamMemberParametersSchema>,
    DeleteTeamMemberByIdUseCase,
    typeof removeTeamMemberParametersSchema
> {
    readonly name = 'remove_team_member';
    readonly description = 'Remove a team member.';
    readonly parameters = removeTeamMemberParametersSchema;
    protected needsApproval = true;

    constructor(
        @inject(DeleteTeamMemberByIdUseCase)
        useCase: DeleteTeamMemberByIdUseCase
    ) {
        super(useCase, (params, scope) => ({
            teamId: scope.teamId,
            teamMemberId: params.memberId
        }));
    }
}
