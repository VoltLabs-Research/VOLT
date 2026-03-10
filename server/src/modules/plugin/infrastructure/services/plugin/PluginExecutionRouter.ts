import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { IPluginExecutionRouter, RoutePluginExecutionInput } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import { SYS_BUCKETS } from '@core/config/minio';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

interface DaemonPluginSyncResponse {
    synced: boolean;
    objectKey: string;
};

interface DaemonAnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
}

interface WorkflowSerializable {
    nodes: Array<{
        id: string;
        type: string;
        position: { x: number; y: number; };
        data: Record<string, unknown>;
    }>;
    edges: Array<{
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
    }>;
}

@injectable()
export default class PluginExecutionRouter implements IPluginExecutionRouter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService)
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
    ){}

    async route(input: RoutePluginExecutionInput): Promise<void> {
        await this.syncPluginBinaryIfNeeded(input.teamClusterId, input.plugin);

        const response = await this.teamClusterDaemonClient.command<DaemonAnalysisStartResponse>(input.teamClusterId, 'analysis.start', {
            analysisId: input.analysisId,
            pluginId: input.plugin.id,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            trajectoryId: input.trajectoryId,
            trajectoryFrames: input.trajectoryFrames,
            workflow: input.plugin.props.workflow.props as unknown as WorkflowSerializable,
            config: input.config,
            selectedFrameOnly: input.selectedFrameOnly,
            timestep: input.timestep
        });

        await this.daemonAnalysisCompletionService.initializeSession(
            input.analysisId,
            response.totalJobs
        );
    }

    private async syncPluginBinaryIfNeeded(teamClusterId: string, plugin: Plugin): Promise<void> {
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const objectKey = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (!objectKey) {
            return;
        }

        const syncResponse = await this.teamClusterDaemonClient.command<DaemonPluginSyncResponse>(teamClusterId, 'plugin.sync', {
            pluginId: plugin.id,
            objectKey
        });

        if (syncResponse.synced) {
            return;
        }

        const buffer = await this.storageService.getBuffer(SYS_BUCKETS.PLUGINS, objectKey);
        await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload', {
            bucket: 'volt-plugins',
            objectKey,
            content: buffer.toString('base64'),
            encoding: 'base64'
        });

        await this.teamClusterDaemonClient.command(teamClusterId, 'plugin.sync', {
            pluginId: plugin.id,
            objectKey
        });
    }
};
