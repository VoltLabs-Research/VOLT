import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const createTeamRoleParametersSchema = z.object({
    name: z.string(),
    permissions: z.array(z.string()).optional(),
    reason: z.string().optional()
});

@injectable()
export class CreateTeamRoleAITool extends TeamUseCaseAITool<
    z.infer<typeof createTeamRoleParametersSchema>,
    CreateTeamRoleUseCase,
    typeof createTeamRoleParametersSchema
> {
    readonly name = 'create_team_role';
    readonly description = 'Create a new role.';
    readonly parameters = createTeamRoleParametersSchema;

    constructor(
        @inject(CreateTeamRoleUseCase)
        useCase: CreateTeamRoleUseCase
    ) {
        super(useCase, (params, scope) => ({
            teamId: scope.teamId,
            name: params.name,
            permissions: params.permissions,
            isSystem: false
        }));
    }
}
