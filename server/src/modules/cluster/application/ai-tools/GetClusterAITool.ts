import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetTeamClusterByIdUseCase from '@modules/cluster/application/use-cases/GetTeamClusterByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetClusterAITool extends AITool {
    readonly name = 'get_cluster';
    readonly description = 'Get detailed information about a specific cluster.';
    readonly parameters = z.object({ teamClusterId: z.string() });

    constructor(
        protected readonly useCase: GetTeamClusterByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId
        });
        const { teamCluster } = result;
        return { summary: `Cluster "${teamCluster.name}" is ${teamCluster.status}.`, data: teamCluster };
    }
}
