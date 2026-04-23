import {
    groupAnalysisFilesByTimestep,
    listAnalysisFiles,
    type AnalysisFileRef,
    type AnalysisFileType
} from '@modules/plugin/utilities/exposure/analysis-file-collection';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { Singleton } from '@shared/infrastructure/di/decorators';
import {
    createZipArchiveStream,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { finished } from 'node:stream/promises';
import { inject } from 'tsyringe';

import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { Archiver } from 'archiver';
import type { PassThrough } from 'node:stream';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type {
    IPluginExposureExportService,
    PluginExposureExportParams
} from '@modules/plugin/domain/port/exposure/IPluginExposureExportService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

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

@Singleton()
export class PluginExposureExportService implements IPluginExposureExportService {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    private async collectFilesByTimestep(
        trajectoryId: string,
        analysisId: string
    ): Promise<Map<number, AnalysisFileRef[]>> {
        const teamClusterId = await this.resolveTeamClusterId(trajectoryId);
        const files = teamClusterId
            ? await this.listClusterAnalysisFiles(teamClusterId, trajectoryId, analysisId)
            : await listAnalysisFiles(this.storageService, trajectoryId, analysisId);
        const groupedFiles = groupAnalysisFilesByTimestep(files);

        for (const [timestep, group] of groupedFiles.entries()) {
            groupedFiles.set(timestep, group.sort(sortAnalysisFilesByObjectName));
        }

        return groupedFiles;
    }

    private appendTimestepArchive(
        archive: Archiver,
        teamClusterId: string | undefined,
        analysisId: string,
        pluginName: string,
        timestep: number,
        files: AnalysisFileRef[]
    ): PassThrough {
        const timestepZipName = `timestep-${timestep}-analysis-${analysisId}-plugin-${pluginName}.zip`;
        const timestepZipStream = createZipArchiveStream(async (timestepArchive) => {
            for (const fileReference of files) {
                const fileStream = teamClusterId
                    ? (await this.objectGatewayClient.getStream(
                        teamClusterId,
                        fileReference.bucket,
                        fileReference.objectName
                    )).stream
                    : await this.storageService.getStream(
                        fileReference.bucket,
                        fileReference.objectName
                    );

                timestepArchive.append(fileStream, {
                    name: fileReference.objectName
                });

                await finished(fileStream);
            }
        });

        archive.append(timestepZipStream, {
            name: timestepZipName
        });

        return timestepZipStream;
    }

    private async resolveTeamClusterId(trajectoryId: string): Promise<string | undefined> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        return trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;
    }

    private getPrefixCollectionConfigs(trajectoryId: string, analysisId: string): PrefixCollectionConfig[] {
        return [
            {
                bucket: SYS_BUCKETS.PLUGINS,
                prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`,
                type: 'data',
                timestepRegex: /\/timestep-(\d+)\.msgpack\.zst$/,
                extensionFilter: '.msgpack.zst'
            },
            {
                bucket: SYS_BUCKETS.PLUGINS,
                prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/charts/`,
                type: 'chart',
                timestepRegex: /\/charts\/(\d+)\//,
                extensionFilter: '.png'
            },
            {
                bucket: SYS_BUCKETS.MODELS,
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

    async exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutputDTO> {
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

        return createZipDownloadResponse({
            filename: `analysis-${params.analysisId}-plugin-${pluginName}`,
            cacheControl: 'public, max-age=31536000, immutable',
            appendEntries: async (bundleArchive) => {
                for (const timestep of timesteps) {
                    const timestepFiles = groupedFiles.get(timestep) || [];

                    if (timestepFiles.length === 0) {
                        continue;
                    }

                    const timestepArchiveStream = this.appendTimestepArchive(
                        bundleArchive,
                        teamClusterId,
                        params.analysisId,
                        pluginName,
                        timestep,
                        timestepFiles
                    );

                    await finished(timestepArchiveStream);
                }
            }
        });
    }
};
