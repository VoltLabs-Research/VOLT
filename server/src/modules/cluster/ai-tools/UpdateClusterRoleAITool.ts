import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class UpdateClusterRoleAITool extends AITool {
    readonly name = 'update_cluster_role';
    readonly description = 'Update the desired role of a cluster.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        role: z.enum(['cluster', 'storage-server', 'compute-node'])
    });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateRole({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.teamClusterId,
            role: params.role
        });
    }
}
