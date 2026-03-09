import type Job from '@modules/jobs/domain/entities/Job';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { IPluginExecutionRouter, RoutePluginExecutionInput } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { SYS_BUCKETS } from '@core/config/minio';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

interface DaemonPluginSyncResponse {
    synced: boolean;
    objectKey: string;
};

interface DaemonExposureDefinition {
    nodeId: string;
    name: string;
    results: string;
    iterable?: string;
};

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

        const entrypointNode = input.plugin.props.workflow.props.nodes.find(
            (node) => node.type === WorkflowNodeType.Entrypoint
        );
        const entrypointData = entrypointNode?.data.entrypoint;

        const exposureNodes = input.plugin.props.workflow.props.nodes.filter(
            (node) => node.type === WorkflowNodeType.Exposure
        );
        const exposures: DaemonExposureDefinition[] = exposureNodes.map((node) => ({
            nodeId: node.id,
            name: node.data.exposure!.name,
            results: node.data.exposure!.results,
            iterable: node.data.exposure!.iterable
        }));

        await this.teamClusterDaemonClient.request(input.teamClusterId, '/api/orchestration/analysis/start', {
            method: 'POST',
            body: {
                analysisId: input.analysisId,
                executionData: {
                    binaryObjectPath: entrypointData?.binaryObjectPath || '',
                    binaryFileName: entrypointData?.binaryFileName,
                    arguments: entrypointData?.arguments || '',
                    pluginId: input.plugin.id,
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    exposures,
                    forEachNodeId: input.forEachNodeId,
                    nodeOutputSnapshots: input.nodeOutputSnapshots
                },
                payload: {
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    jobs: input.jobs.map((job) => job.props)
                }
            }
        });

        await this.daemonAnalysisCompletionService.initializeSession(
            input.analysisId,
            input.jobs.length
        );
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
