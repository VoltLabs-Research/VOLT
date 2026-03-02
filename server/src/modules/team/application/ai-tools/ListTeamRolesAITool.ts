import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import ListTeamRolesByTeamIdUseCase from '@modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';

@injectable()
export class ListTeamRolesAITool extends AITool {
    readonly name = 'list_team_roles';
    readonly description = 'List all roles in the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(ListTeamRolesByTeamIdUseCase)
        protected readonly useCase: ListTeamRolesByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: 1, limit: 100 });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.data.length} roles.`, data: result.value.data };
    }
}
