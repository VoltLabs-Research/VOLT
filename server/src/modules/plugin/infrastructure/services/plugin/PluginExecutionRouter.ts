import type Job from '@modules/jobs/domain/entities/Job';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { IPluginExecutionRouter, RoutePluginExecutionInput } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

interface DaemonPluginSyncResponse {
    synced: boolean;
    objectKey: string;
};

@injectable()
export default class PluginExecutionRouter implements IPluginExecutionRouter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async route(input: RoutePluginExecutionInput): Promise<void> {
        await this.syncPluginBinaryIfNeeded(input.teamClusterId, input.plugin);

        await this.teamClusterDaemonClient.request(input.teamClusterId, '/api/orchestration/analysis/start', {
            method: 'POST',
            body: {
                analysisId: input.analysisId,
                payload: {
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    jobs: input.jobs.map((job) => job.props)
                }
            }
        });
    }

    private async syncPluginBinaryIfNeeded(teamClusterId: string, plugin: Plugin): Promise<void> {
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const objectKey = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (!objectKey) {
            return;
        }

        const syncResponse = await this.teamClusterDaemonClient.request<DaemonPluginSyncResponse>(
            teamClusterId,
            '/api/orchestration/plugins/sync',
            {
                method: 'POST',
                body: {
                    pluginId: plugin.id,
                    objectKey
                }
            }
        );

        if (syncResponse.synced) {
            return;
        }

        const buffer = await this.storageService.getBuffer(SYS_BUCKETS.PLUGINS, objectKey);
        await this.teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/object-upload', {
            method: 'POST',
            body: {
                bucket: 'volt-plugins',
                objectKey,
                content: buffer.toString('base64'),
                encoding: 'base64'
            }
        });

        await this.teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/plugins/sync', {
            method: 'POST',
            body: {
                pluginId: plugin.id,
                objectKey
            }
        });
    }
};
