import {
    groupAnalysisFilesByTimestep,
    type AnalysisFileRef,
    type AnalysisFileType
} from '@modules/plugin/utilities/exposure/analysis-file-collection';
import type {
    IClusterObjectArchiveService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import { sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';

import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import path from 'node:path';
import { v4 } from 'uuid';

import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';

export interface PluginExposureExportParams {
    analysisId: string;
    trajectoryId: string;
    pluginName: string;
}

interface PrefixCollectionConfig {
    bucket: string;
    prefix: string;
    type: AnalysisFileType;
    timestepRegex: RegExp;
    extensionFilter?: string;
}

const sortAnalysisFilesByObjectName = (left: AnalysisFileRef, right: AnalysisFileRef): number => {
    return left.objectName.localeCompare(right.objectName);
};

export class PluginExposureExportService {
    constructor(
        private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    private async collectFilesByTimestep(
        trajectoryId: string,
        analysisId: string
    ): Promise<Map<number, AnalysisFileRef[]>> {
        const teamClusterId = await this.resolveTeamClusterId(trajectoryId);
        const files = await this.listClusterAnalysisFiles(teamClusterId, trajectoryId, analysisId);
        const groupedFiles = groupAnalysisFilesByTimestep(files);

        for (const [timestep, group] of groupedFiles.entries()) {
            groupedFiles.set(timestep, group.sort(sortAnalysisFilesByObjectName));
        }

        return groupedFiles;
    }

    private async resolveTeamClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await TrajectoryModel.findById(trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                ErrorCodes.TRAJECTORY_NOT_FOUND
            );
        }

        const storageClusterId = trajectory.storageClusterId?.toString();
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            );
        }

        return storageClusterId;
    }

    private getPrefixCollectionConfigs(trajectoryId: string, analysisId: string): PrefixCollectionConfig[] {
        return [
            {
                bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`,
                type: 'data',
                timestepRegex: /\/timestep-(\d+)\.parquet$/,
                extensionFilter: '.parquet'
            },
            {
                bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/charts/`,
                type: 'chart',
                timestepRegex: /\/charts\/(\d+)\//,
                extensionFilter: '.png'
            },
            {
                bucket: TEAM_CLUSTER_BUCKETS.MODELS,
                prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`,
                type: 'model',
                timestepRegex: /\/glb\/(\d+)\//,
                extensionFilter: '.glb.zst'
            }
        ];
    }

    private async collectClusterFilesByPrefix(
        teamClusterId: string,
        config: PrefixCollectionConfig
    ): Promise<AnalysisFileRef[]> {
        const files: AnalysisFileRef[] = [];

        for await (const objectName of this.objectGatewayClient.listAll(teamClusterId, {
            bucket: config.bucket,
            prefix: config.prefix
        })) {
            if (config.extensionFilter && !objectName.endsWith(config.extensionFilter)) {
                continue;
            }

            const match = objectName.match(config.timestepRegex);
            if (!match) {
                continue;
            }

            files.push({
                bucket: config.bucket,
                objectName,
                type: config.type,
                timestep: Number(match[1])
            });
        }

        return files;
    }

    private async listClusterAnalysisFiles(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string
    ): Promise<AnalysisFileRef[]> {
        const groups = await Promise.all(
            this.getPrefixCollectionConfigs(trajectoryId, analysisId).map((config) => {
                return this.collectClusterFilesByPrefix(teamClusterId, config);
            })
        );

        return groups.flat().sort(sortAnalysisFilesByObjectName);
    }

    async exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutput> {
        const pluginName = sanitizeDownloadName(params.pluginName, 'plugin');
        const teamClusterId = await this.resolveTeamClusterId(params.trajectoryId);
        const groupedFiles = await this.collectFilesByTimestep(params.trajectoryId, params.analysisId);
        const timesteps = Array.from(groupedFiles.keys()).sort((left, right) => left - right);

        if (timesteps.length === 0) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        return this.archiveService.createArchiveDownload({
            teamClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/plugin-exposures/${params.analysisId}/${v4()}.zip`,
            filename: `analysis-${params.analysisId}-plugin-${pluginName}.zip`,
            cacheControl: 'public, max-age=31536000, immutable',
            entries: timesteps.flatMap((timestep) => {
                const timestepFiles = groupedFiles.get(timestep) || [];
                return timestepFiles.map((fileReference) => ({
                    type: 'object' as const,
                    ownerClusterId: teamClusterId,
                    bucket: fileReference.bucket,
                    objectKey: fileReference.objectName,
                    name: `timestep-${timestep}/${fileReference.type}/${path.basename(fileReference.objectName)}`
                }));
            })
        });
    }
}
