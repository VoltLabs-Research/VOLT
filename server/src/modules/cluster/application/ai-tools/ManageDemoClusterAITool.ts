import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import DeleteDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/DeleteDemoTeamClusterUseCase';
import GetDemoTeamClusterStatusUseCase from '@modules/cluster/application/use-cases/GetDemoTeamClusterStatusUseCase';
import ProvisionDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/ProvisionDemoTeamClusterUseCase';
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

    constructor(
        protected readonly provisionUseCase: ProvisionDemoTeamClusterUseCase,
        protected readonly statusUseCase: GetDemoTeamClusterStatusUseCase,
        protected readonly deleteUseCase: DeleteDemoTeamClusterUseCase
    ) {
        super();
    }

    async execute(params: ManageDemoClusterParams, scope: AIToolScope) {
        if (params.action === 'provision') {
            const result = await this.provisionUseCase.execute({ teamId: scope.teamId, userId: scope.userId });
            return {
                summary: `Demo cluster "${result.teamCluster.name}" provisioned.`,
                data: result
            };
        }

        if (params.action === 'delete') {
            const result = await this.deleteUseCase.execute({ teamId: scope.teamId, userId: scope.userId });
            return {
                summary: result.teardownScheduled
                    ? 'Demo cluster teardown scheduled.'
                    : 'No active demo cluster to delete.',
                data: result
            };
        }

        const result = await this.statusUseCase.execute({ teamId: scope.teamId, userId: scope.userId });
        return {
            summary: result.hasActiveDemo
                ? `Active demo cluster${result.remainingMs !== null ? ` (${Math.max(0, Math.round(result.remainingMs / 60000))} min remaining)` : ''}.`
                : 'No active demo cluster.',
            data: result
        };
    }
}
