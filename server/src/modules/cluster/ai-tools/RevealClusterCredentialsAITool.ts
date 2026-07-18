import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const MASKED = '••••••••';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RevealClusterCredentialsAITool extends AITool {
    readonly name = 'reveal_cluster_credentials';
    readonly description = 'Reveal which service credentials a cluster holds. Requires the requesting user\'s account password for confirmation. Secret values are NEVER returned in plaintext — only key names and masked references.';
    readonly parameters = z.object({
        clusterId: z.string(),
        password: z.string().describe('The requesting user\'s account password, required to confirm the sensitive reveal operation.')
    });
    protected readonly needsApproval = true;

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.revealCredentials({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.clusterId,
            password: params.password
        });

        const { services } = result;
        const maskedServices = {
            minio: { port: services.minio.port, username: MASKED, password: MASKED },
            redis: { port: services.redis.port, username: MASKED, password: MASKED },
            mongodb: { port: services.mongodb.port, username: MASKED, password: MASKED },
            daemon: { port: services.daemon.port, password: MASKED }
        };

        return {
            summary: 'Cluster credentials confirmed for minio, redis, mongodb, and daemon (values masked).',
            data: {
                teamClusterId: result.teamClusterId,
                credentialKeys: ['minio.username', 'minio.password', 'redis.username', 'redis.password', 'mongodb.username', 'mongodb.password', 'daemon.password'],
                services: maskedServices
            }
        };
    }
}
