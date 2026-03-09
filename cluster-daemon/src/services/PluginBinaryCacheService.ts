import { LocalMinioService } from './LocalMinioService';
import { logger } from './logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

const CACHE_DIR = '/tmp/plugin-bin-cache';
const PLUGINS_BUCKET = 'volt-plugins';

export class PluginBinaryCacheService {
    constructor(private readonly minioService: LocalMinioService) {
    }

    /**
     * Returns the local filesystem path of the plugin binary.
     * Downloads from daemon MinIO on first request; subsequent calls return the cached path.
     */
    async getBinaryPath(binaryObjectPath: string, binaryFileName?: string): Promise<string> {
        const fileName = binaryFileName || path.basename(binaryObjectPath);
        const localPath = path.join(CACHE_DIR, fileName);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            return localPath;
        } catch {
            // Not cached yet, download it
        }

        await fs.mkdir(CACHE_DIR, { recursive: true });

        const stream = await this.minioService.getObjectStream(PLUGINS_BUCKET, binaryObjectPath);
        await this.writeStreamToFile(stream, localPath);
        await fs.chmod(localPath, 0o755);

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    }

    private writeStreamToFile(stream: Readable, filePath: string): Promise<void> {
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
    }
}
