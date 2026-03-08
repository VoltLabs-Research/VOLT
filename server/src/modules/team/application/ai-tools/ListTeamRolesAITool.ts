import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import ListTeamRolesByTeamIdUseCase from '@modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';
import type { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';
import type { TeamAIToolListResult } from './TeamUseCaseAITool';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const listTeamRolesParametersSchema = z.object({});

@injectable()
export class ListTeamRolesAITool extends TeamUseCaseAITool<
    z.infer<typeof listTeamRolesParametersSchema>,
    ListTeamRolesByTeamIdUseCase,
    typeof listTeamRolesParametersSchema,
    TeamAIToolListResult<TeamRoleProps[]>
> {
    readonly name = 'list_team_roles';
    readonly description = 'List all roles in the selected team.';
    readonly parameters = listTeamRolesParametersSchema;

    constructor(
        @inject(ListTeamRolesByTeamIdUseCase)
        useCase: ListTeamRolesByTeamIdUseCase
    ) {
        super(
            useCase,
            (_, scope) => ({ teamId: scope.teamId, page: 1, limit: 100 }),
            (output) => ({
                summary: `Found ${output.data.length} roles.`,
                data: output.data
            })
        );
    }
}
