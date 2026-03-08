import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import ListTeamRolesByTeamIdUseCase from '@modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { TeamAIToolListResult } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';

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
            (_, scope) => ({
                teamId: scope.teamId,
                page: 1,
                limit: 100
            }),
            (output) => ({
                summary: `Found ${output.data.length} roles.`,
                data: output.data
            })
        );
    }
};
