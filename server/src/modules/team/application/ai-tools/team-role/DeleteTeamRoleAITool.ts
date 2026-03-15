import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

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

    constructor(
        @inject(DeleteTeamRoleByIdUseCase)
        useCase: DeleteTeamRoleByIdUseCase
    ) {
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                roleId: params.roleId,
                userId: scope.userId
            }),
            (output) => output
        );
    }
};
