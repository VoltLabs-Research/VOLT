import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetClusterHealthSummaryAITool extends AITool {
    readonly name = 'get_cluster_health_summary';
    readonly description = 'Summarize a cluster\'s health: connectivity status, installed version, heartbeat, capabilities, and live queue runtime.';
    readonly parameters = z.object({ clusterId: z.string() });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const clusterResult = await this.#service.getById({
            teamId: scope.teamId,
            teamClusterId: params.clusterId
        });

        const snapshotResult = await this.#service.getRuntimeSnapshot({
            teamId: scope.teamId,
            teamClusterId: params.clusterId
        });

        const cluster = clusterResult.teamCluster;
        const snapshot = snapshotResult;

        return {
            summary: `Cluster "${cluster.name}" is ${cluster.status} with ${snapshot.daemonQueues.length} live daemon queue(s).`,
            data: {
                clusterId: cluster._id,
                name: cluster.name,
                status: cluster.status,
                installedVersion: cluster.installedVersion,
                lastHeartbeatAt: cluster.lastHeartbeatAt,
                lastDisconnectAt: cluster.lastDisconnectAt,
                effectiveCapabilities: cluster.effectiveCapabilities,
                runtime: {
                    capturedAt: snapshot.capturedAt,
                    queueConcurrency: snapshot.queueConcurrency,
                    daemonQueues: snapshot.daemonQueues
                }
            }
        };
    }
}
