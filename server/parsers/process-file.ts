import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import TrajectoryParserFactory from '@/parsers/factory';
import DumpStorage from '@/services/trajectory/dump-storage';

export interface ParseTaskArgs {
    taskId: number;
    trajectoryId: string;
    tempPath: string;
    originalName: string;
    fileSize: number;
}

export interface ParseResult {
    taskId: number;
    success: boolean;
    data?: {
        frameInfo: any;
        srcPath: string;
        originalSize: number;
        originalName: string;
    };
    error?: string;
}

export const processTrajectoryFile = async ({
    taskId,
    trajectoryId,
    tempPath,
    originalName,
    fileSize
}: ParseTaskArgs): Promise<ParseResult> => {
    try {
        // Parse and validate
        const frameInfo = await TrajectoryParserFactory.parseMetadata(tempPath);

        // Move file to cache location
        const cachePath = DumpStorage.getCachePath(trajectoryId, frameInfo.timestep);
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.rename(tempPath, cachePath);

        return {
            taskId,
            success: true,
            data: {
                frameInfo,
                srcPath: `minio://${trajectoryId}/${frameInfo.timestep}`,
                originalSize: fileSize,
                originalName
            }
        };
    } catch (err: any) {
        // Clean up temp file on error
        await fs.rm(tempPath).catch(() => { });

        return {
            taskId,
            success: false,
            error: err?.message || 'Unknown parsing error'
        };
    }
};
