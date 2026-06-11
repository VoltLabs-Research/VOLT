import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetClusterResourceLimitsUseCase from '@modules/cluster/application/use-cases/GetClusterResourceLimitsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
        if (!result.success) throw result.error;
        const { resourceLimits } = result.value;
        return {
            summary: `Cluster limits: ${resourceLimits.maxCpus ?? 'unknown'} CPUs, ${resourceLimits.maxMemoryMB ?? 'unknown'} MB.`,
            data: resourceLimits
        };
    }
}
