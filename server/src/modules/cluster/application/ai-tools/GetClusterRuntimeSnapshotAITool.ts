import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetTeamClusterRuntimeSnapshotUseCase from '@modules/cluster/application/use-cases/GetTeamClusterRuntimeSnapshotUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetClusterRuntimeSnapshotAITool extends AITool {
    readonly name = 'get_cluster_runtime_snapshot';
    readonly description = 'Get the live queue runtime snapshot for a cluster.';
    readonly parameters = z.object({ teamClusterId: z.string() });

    constructor(
        protected readonly useCase: GetTeamClusterRuntimeSnapshotUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId
        });
        if (!result.success) throw result.error;
        return {
            summary: `Captured ${result.value.daemonQueues.length} daemon queues at ${result.value.capturedAt}.`,
            data: result.value
        };
    }
}
