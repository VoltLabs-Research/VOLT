import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetClusterResourceLimitsUseCase from '@modules/cluster/application/use-cases/GetClusterResourceLimitsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetClusterResourceLimitsAITool extends AITool {
    readonly name = 'get_cluster_resource_limits';
    readonly description = 'Get the CPU and memory resource limits for a cluster.';
    readonly parameters = z.object({ teamClusterId: z.string() });

    constructor(
        protected readonly useCase: GetClusterResourceLimitsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId
        });
        const { resourceLimits } = result;
        return {
            summary: `Cluster limits: ${resourceLimits.maxCpus ?? 'unknown'} CPUs, ${resourceLimits.maxMemoryMB ?? 'unknown'} MB.`,
            data: resourceLimits
        };
    }
}
