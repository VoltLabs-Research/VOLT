import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['provision', 'status', 'delete'])
});

type ManageDemoClusterParams = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ManageDemoClusterAITool extends AITool<ManageDemoClusterParams> {
    readonly name = 'manage_demo_cluster';
    readonly description = 'Provision, check the status of, or delete the team\'s ephemeral demo cluster.';
    readonly parameters = parameters;
    protected readonly needsApproval = (input: ManageDemoClusterParams): boolean => input.action === 'delete';

    #service = new ClusterService();

    async execute(params: ManageDemoClusterParams, scope: AIToolScope) {
        if (params.action === 'provision') {
            const result = await this.#service.provisionDemo({ teamId: scope.teamId, userId: scope.userId });
            return {
                summary: `Demo cluster "${result.teamCluster.name}" provisioned.`,
                data: result
            };
        }

        if (params.action === 'delete') {
            const result = await this.#service.deleteDemo({ teamId: scope.teamId, userId: scope.userId });
            return {
                summary: result.teardownScheduled
                    ? 'Demo cluster teardown scheduled.'
                    : 'No active demo cluster to delete.',
                data: result
            };
        }

        const result = await this.#service.getDemoStatus({ teamId: scope.teamId, userId: scope.userId });
        return {
            summary: result.hasActiveDemo
                ? `Active demo cluster${result.remainingMs !== null ? ` (${Math.max(0, Math.round(result.remainingMs / 60000))} min remaining)` : ''}.`
                : 'No active demo cluster.',
            data: result
        };
    }
}
