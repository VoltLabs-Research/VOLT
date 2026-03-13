import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import UpdateTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

const updateTeamRoleParametersSchema = z.object({
    roleId: z.string(),
    name: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    reason: z.string().optional()
});

@injectable()
export class UpdateTeamRoleAITool extends TeamUseCaseAITool<
    z.infer<typeof updateTeamRoleParametersSchema>,
    UpdateTeamRoleByIdUseCase,
    typeof updateTeamRoleParametersSchema
> {
    readonly name = 'update_team_role';
    readonly description = 'Update a team role.';
    readonly parameters = updateTeamRoleParametersSchema;

    constructor(
        @inject(UpdateTeamRoleByIdUseCase)
        useCase: UpdateTeamRoleByIdUseCase
    ) {
        super(
            useCase,
            (params) => ({
                roleId: params.roleId,
                name: params.name,
                permissions: params.permissions
            }),
            (output) => output
        );
    }
};
