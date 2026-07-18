import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetTeamClusterByIdUseCase from '@modules/cluster/use-cases/GetTeamClusterByIdUseCase';
import GetTeamClusterRuntimeSnapshotUseCase from '@modules/cluster/use-cases/GetTeamClusterRuntimeSnapshotUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetClusterHealthSummaryAITool extends AITool {
    readonly name = 'get_cluster_health_summary';
    readonly description = 'Summarize a cluster\'s health: connectivity status, installed version, heartbeat, capabilities, and live queue runtime.';
    readonly parameters = z.object({ clusterId: z.string() });

    constructor(
        protected readonly clusterUseCase: GetTeamClusterByIdUseCase,
        protected readonly snapshotUseCase: GetTeamClusterRuntimeSnapshotUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const clusterResult = await this.clusterUseCase.execute({
            teamId: scope.teamId,
            teamClusterId: params.clusterId
        });

        const snapshotResult = await this.snapshotUseCase.execute({
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
