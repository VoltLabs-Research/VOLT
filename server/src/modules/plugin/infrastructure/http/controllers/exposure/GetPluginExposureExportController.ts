import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { SYS_BUCKETS } from '@core/config/minio';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

interface StorageFileRef {
    bucket: string;
    objectName: string;
}

const sanitizeFilePart = (value: string): string => {
    const sanitized = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return sanitized || 'plugin';
};

const sortByObjectName = (a: StorageFileRef, b: StorageFileRef): number => {
    return a.objectName.localeCompare(b.objectName);
};

@injectable()
export default class GetPluginExposureExportController{
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    private appendGroupedFile(
        groupedFiles: Map<number, StorageFileRef[]>,
        timestep: number,
        fileRef: StorageFileRef
    ): void {
        const files = groupedFiles.get(timestep) || [];
        files.push(fileRef);
        groupedFiles.set(timestep, files);
    }

    private async collectMsgpackFiles(
        groupedFiles: Map<number, StorageFileRef[]>,
        trajectoryId: string,
        analysisId: string
    ): Promise<void> {
        const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`;

        for await (const objectName of this.storageService.listByPrefix(SYS_BUCKETS.PLUGINS, prefix, true)) {
            const match = objectName.match(/\/timestep-(\d+)\.msgpack$/);
            if (!match) {
                continue;
            }

            this.appendGroupedFile(groupedFiles, Number(match[1]), {
                bucket: SYS_BUCKETS.PLUGINS,
                objectName
            });
        }
    }

    private async collectChartFiles(
        groupedFiles: Map<number, StorageFileRef[]>,
        trajectoryId: string,
        analysisId: string
    ): Promise<void> {
        const prefix = `trajectory-${trajectoryId}/analysis-${analysisId}/charts/`;

        for await (const objectName of this.storageService.listByPrefix(SYS_BUCKETS.PLUGINS, prefix, true)) {
            if (!objectName.endsWith('.png')) {
                continue;
            }

            const match = objectName.match(/\/charts\/(\d+)\//);
            if (!match) {
                continue;
            }

            this.appendGroupedFile(groupedFiles, Number(match[1]), {
                bucket: SYS_BUCKETS.PLUGINS,
                objectName
            });
        }
    }

    private async collectGLBFiles(
        groupedFiles: Map<number, StorageFileRef[]>,
        trajectoryId: string,
        analysisId: string
    ): Promise<void> {
        const prefix = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`;

        for await (const objectName of this.storageService.listByPrefix(SYS_BUCKETS.MODELS, prefix, true)) {
            if (!objectName.endsWith('.glb')) {
                continue;
            }

            const match = objectName.match(/\/glb\/(\d+)\//);
            if (!match) {
                continue;
            }

            this.appendGroupedFile(groupedFiles, Number(match[1]), {
                bucket: SYS_BUCKETS.MODELS,
                objectName
            });
        }
    }

    private async collectFilesByTimestep(
        trajectoryId: string,
        analysisId: string
    ): Promise<Map<number, StorageFileRef[]>> {
        const groupedFiles = new Map<number, StorageFileRef[]>();

        await Promise.all([
            this.collectMsgpackFiles(groupedFiles, trajectoryId, analysisId),
            this.collectChartFiles(groupedFiles, trajectoryId, analysisId),
            this.collectGLBFiles(groupedFiles, trajectoryId, analysisId)
        ]);

        for (const [timestep, files] of groupedFiles.entries()) {
            groupedFiles.set(timestep, files.sort(sortByObjectName));
        }

        return groupedFiles;
    }

    private createTimestepZipStream(files: StorageFileRef[]): PassThrough {
        const output = new PassThrough();
        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.on('error', (error) => output.destroy(error));
        archive.pipe(output);

        (async () => {
            for (const fileRef of files) {
                const fileStream = await this.storageService.getStream(fileRef.bucket, fileRef.objectName);
                archive.append(fileStream, { name: fileRef.objectName });
            }

            await archive.finalize();
        })().catch((error) => output.destroy(error));

        return output;
    }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { teamId, analysisId } = req.params;
            const analysis = await this.analysisRepository.findById(String(analysisId));
            if (!analysis) {
                throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);
            }

            if (String(analysis.props.team) !== String(teamId)) {
                throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);
            }

            const pluginId = String(analysis.props.plugin);
            const plugin = await this.pluginRepository.findById(pluginId);
            const pluginName = sanitizeFilePart(
                plugin?.props?.modifier?.name || pluginId
            );

            const trajectoryId = String(analysis.props.trajectory);
            const groupedFiles = await this.collectFilesByTimestep(trajectoryId, String(analysisId));
            const timesteps = Array.from(groupedFiles.keys()).sort((a, b) => a - b);
            if (timesteps.length === 0) {
                throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, ErrorCodes.FILE_NOT_FOUND, 404);
            }

            const bundleName = `analysis-${analysisId}-plugin-${pluginName}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${bundleName}"`);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

            const bundleArchive = archiver('zip', { zlib: { level: 5 } });
            bundleArchive.on('error', (error) => next(error));
            bundleArchive.pipe(res);

            for (const timestep of timesteps) {
                const timestepFiles = groupedFiles.get(timestep) || [];
                if (timestepFiles.length === 0) {
                    continue;
                }

                const timestepZipName = `timestep-${timestep}-analysis-${analysisId}-plugin-${pluginName}.zip`;
                const timestepZipStream = this.createTimestepZipStream(timestepFiles);
                bundleArchive.append(timestepZipStream, { name: timestepZipName });
            }

            await bundleArchive.finalize();
        } catch (error) {
            next(error);
        }
    }
}
