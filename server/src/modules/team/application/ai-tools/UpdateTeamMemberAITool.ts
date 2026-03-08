import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import UpdateTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/UpdateTeamMemberByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const updateTeamMemberParametersSchema = z.object({
    memberId: z.string(),
    roleId: z.string().optional(),
    reason: z.string().optional()
});

@injectable()
export class UpdateTeamMemberAITool extends TeamUseCaseAITool<
    z.infer<typeof updateTeamMemberParametersSchema>,
    UpdateTeamMemberByIdUseCase,
    typeof updateTeamMemberParametersSchema
> {
    readonly name = 'update_team_member';
    readonly description = 'Update a team member role.';
    readonly parameters = updateTeamMemberParametersSchema;
    protected needsApproval = true;

    constructor(
        @inject(UpdateTeamMemberByIdUseCase)
        useCase: UpdateTeamMemberByIdUseCase
    ) {
        super(useCase, (params) => ({
            teamMemberId: params.memberId,
            data: {
                role: params.roleId
            }
        }));
    }
}
