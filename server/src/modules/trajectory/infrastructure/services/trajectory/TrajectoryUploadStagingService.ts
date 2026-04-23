import type { TrajectoryUploadFile } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';
import type { ITrajectoryUploadStagingService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryUploadStagingService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import fs from 'node:fs/promises';
import path from 'node:path';

@Singleton()
export default class TrajectoryUploadStagingService implements ITrajectoryUploadStagingService {
    constructor(
        
        private readonly tempFileService: TempFileService
    ) {}

    public async stageUploads(trajectoryId: string, files: TrajectoryUploadFile[]): Promise<TrajectoryUploadFile[]> {
        const incomingDir = this.tempFileService.getDirPath(`trajectory-uploads/${trajectoryId}/incoming`);
        await this.tempFileService.ensureDir(incomingDir);

        const stagedFiles: TrajectoryUploadFile[] = [];
        for (const [index, file] of files.entries()) {
            const stagedPath = path.join(
                incomingDir,
                this.buildStagedFilename(file, index)
            );

            await this.moveFile(file.path, stagedPath);
            stagedFiles.push({
                ...file,
                path: stagedPath
            });
        }

        return stagedFiles;
    }

    private buildStagedFilename(file: TrajectoryUploadFile, index: number): string {
        const originalname = file.originalname?.trim();
        const safeName = path.basename(originalname && originalname.length > 0 ? originalname : `trajectory-upload-${index}`);

        return `${index.toString().padStart(4, '0')}-${safeName}`;
    }

    private async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
        try {
            await fs.rename(sourcePath, destinationPath);
            return;
        } catch (error: unknown) {
            if (!this.isCrossDeviceRenameError(error)) {
                throw error;
            }
        }

        await fs.copyFile(sourcePath, destinationPath);
        await fs.unlink(sourcePath).catch((error: unknown) => {
            logger.warn(
                { destinationPath, err: error, sourcePath },
                '@trajectory-upload-staging: failed to delete original upload after copy fallback'
            );
        });
    }

    private isCrossDeviceRenameError(error: unknown): boolean {
        if (!(error instanceof Error) || !('code' in error)) {
            return false;
        }

        return error.code === 'EXDEV';
    }
};
