import { logger } from '../../../core/logger';
import { DAEMON_PATHS } from '../../../core/paths';
import { MinioService } from '../../platform/services';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';

const buildCacheKey = (binaryObjectPath: string): string => {
    return path.basename(binaryObjectPath);
};

const writeStreamToFile = (stream: Readable, filePath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', async () => {
            try {
                await fs.writeFile(filePath, Buffer.concat(chunks));
                resolve();
            } catch (error) {
                reject(error);
            }
        });
        stream.on('error', reject);
    });
};

export interface PluginBinaryCacheService {
    getBinaryPath(binaryObjectPath: string): Promise<string>;
};

export const createPluginBinaryCacheService = (minioService: MinioService): PluginBinaryCacheService => ({
    async getBinaryPath(binaryObjectPath) {
        const cacheKey = buildCacheKey(binaryObjectPath);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            return localPath;
        } catch {
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

        const stream = await minioService.getObjectStream(PLUGINS_BUCKET, binaryObjectPath);
        await writeStreamToFile(stream, localPath);
        await fs.chmod(localPath, 0o755);

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    }
});
