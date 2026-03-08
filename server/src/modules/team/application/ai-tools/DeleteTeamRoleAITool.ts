import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const deleteTeamRoleParametersSchema = z.object({
    roleId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class DeleteTeamRoleAITool extends TeamUseCaseAITool<
    z.infer<typeof deleteTeamRoleParametersSchema>,
    DeleteTeamRoleByIdUseCase,
    typeof deleteTeamRoleParametersSchema
> {
    readonly name = 'delete_team_role';
    readonly description = 'Delete a team role.';
    readonly parameters = deleteTeamRoleParametersSchema;
    protected needsApproval = true;

    constructor(
        @inject(DeleteTeamRoleByIdUseCase)
        useCase: DeleteTeamRoleByIdUseCase
    ) {
        super(useCase, (params, scope) => ({
            teamId: scope.teamId,
            roleId: params.roleId
        }));
    }
}
