import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetClusterRuntimeSnapshotAITool extends AITool {
    readonly name = 'get_cluster_runtime_snapshot';
    readonly description = 'Get the live queue runtime snapshot for a cluster.';
    readonly parameters = z.object({ teamClusterId: z.string() });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.getRuntimeSnapshot({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId
        });
        return {
            summary: `Captured ${result.daemonQueues.length} daemon queues at ${result.capturedAt}.`,
            data: result
        };
    }
}
