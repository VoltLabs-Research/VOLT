import { inject, injectable } from 'tsyringe';
import type { Archiver } from 'archiver';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type {
    IPluginExposureExportService,
    PluginExposureExportParams
} from '@modules/plugin/domain/port/IPluginExposureExportService';
import type { AnalysisFileRef } from '@modules/plugin/infrastructure/utilities/analysis-file-collection';
import {
    groupAnalysisFilesByTimestep,
    listAnalysisFiles
} from '@modules/plugin/infrastructure/utilities/analysis-file-collection';
import {
    createZipArchiveStream,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@modules/plugin/application/helpers/create-download-response';
import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

const sortAnalysisFilesByObjectName = (left: AnalysisFileRef, right: AnalysisFileRef): number => {
    return left.objectName.localeCompare(right.objectName);
};

@injectable()
export class PluginExposureExportService implements IPluginExposureExportService {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    private async collectFilesByTimestep(
        trajectoryId: string,
        analysisId: string
    ): Promise<Map<number, AnalysisFileRef[]>> {
        const files = await listAnalysisFiles(this.storageService, trajectoryId, analysisId);
        const groupedFiles = groupAnalysisFilesByTimestep(files);

        for (const [timestep, group] of groupedFiles.entries()) {
            groupedFiles.set(timestep, group.sort(sortAnalysisFilesByObjectName));
        }

        return groupedFiles;
    }

    private async ensureFilesExist(groupedFiles: Map<number, AnalysisFileRef[]>): Promise<void> {
        for (const files of groupedFiles.values()) {
            for (const fileReference of files) {
                await this.storageService.getStat(fileReference.bucket, fileReference.objectName);
            }
        }
    }

    private appendTimestepArchive(
        archive: Archiver,
        analysisId: string,
        pluginName: string,
        timestep: number,
        files: AnalysisFileRef[]
    ): void {
        const timestepZipName = `timestep-${timestep}-analysis-${analysisId}-plugin-${pluginName}.zip`;
        const timestepZipStream = createZipArchiveStream(async (timestepArchive) => {
            for (const fileReference of files) {
                const fileStream = await this.storageService.getStream(
                    fileReference.bucket,
                    fileReference.objectName
                );

                timestepArchive.append(fileStream, {
                    name: fileReference.objectName
                });
            }
        });

        archive.append(timestepZipStream, {
            name: timestepZipName
        });
    }

    async exportAnalysisExposureBundle(params: PluginExposureExportParams): Promise<DownloadStreamOutputDTO> {
        const pluginName = sanitizeDownloadName(params.pluginName, 'plugin');
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
            prepare: async () => {
                await this.ensureFilesExist(groupedFiles);
            },
            appendEntries: async (bundleArchive) => {
                for (const timestep of timesteps) {
                    const timestepFiles = groupedFiles.get(timestep) || [];

                    if (timestepFiles.length === 0) {
                        continue;
                    }

                    this.appendTimestepArchive(
                        bundleArchive,
                        params.analysisId,
                        pluginName,
                        timestep,
                        timestepFiles
                    );
                }
            }
        });
    }
}
