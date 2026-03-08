import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import DeleteTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

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
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                teamMemberId: params.memberId
            }),
            (output) => output
        );
    }
};
