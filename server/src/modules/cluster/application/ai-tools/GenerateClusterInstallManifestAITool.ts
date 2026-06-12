import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GenerateTeamClusterInstallManifestUseCase from '@modules/cluster/application/use-cases/GenerateTeamClusterInstallManifestUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GenerateClusterInstallManifestAITool extends AITool {
    readonly name = 'generate_cluster_install_manifest';
    readonly description = 'Generate the Docker Compose enrollment install manifest (files + pinned images) a user runs on their machine to bring a cluster online.';
    readonly parameters = z.object({
        clusterId: z.string().describe('The id of the cluster the manifest enrolls.'),
        daemonPassword: z.string().describe('The daemon password to embed in the generated manifest.'),
        installRoot: z.string().describe('Absolute filesystem path on the target machine where the cluster stack is installed.'),
        ports: z.object({
            minio: z.number(),
            redis: z.number(),
            mongodb: z.number(),
            daemon: z.number()
        }).describe('Host ports to bind each cluster service to.')
    });

    constructor(
        protected readonly useCase: GenerateTeamClusterInstallManifestUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>) {
        const result = await this.useCase.execute({
            teamClusterId: params.clusterId,
            daemonPassword: params.daemonPassword,
            installRoot: params.installRoot,
            ports: params.ports
        });
        if (!result.success) throw result.error;
        const { manifest } = result.value;
        return {
            summary: `Generated install manifest v${manifest.manifestVersion} (${manifest.files.length} files) for project "${manifest.composeProjectName}".`,
            data: manifest
        };
    }
}
