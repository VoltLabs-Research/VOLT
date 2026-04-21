import { AITool } from '@shared/application/ai/AITool';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface ListTeamRolesResult {
    summary: string;
    data: PersistedOutput<TeamRoleProps>[];
};

const listTeamRolesParametersSchema = z.object({});

@injectable()
export class ListTeamRolesAITool extends AITool<
    z.infer<typeof listTeamRolesParametersSchema>,
    ListTeamRolesResult,
    typeof listTeamRolesParametersSchema
> {
    readonly name = 'list_team_roles';
    readonly description = 'List all roles in the selected team.';
    readonly parameters = listTeamRolesParametersSchema;

    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        protected readonly repository: ITeamRoleRepository
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope): Promise<ListTeamRolesResult> {
        const result = await this.repository.findAll({
            filter: { team: scope.teamId },
            page: 1,
            limit: 100
        });

        return {
            summary: `Found ${result.data.length} roles.`,
            data: result.data.map((entity) => toPersistedOutput(entity))
        };
    }
};
