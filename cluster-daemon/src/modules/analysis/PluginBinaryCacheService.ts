import { DAEMON_TOKENS } from '../../core/tokens';
import { logger } from '../../core/logger';
import { DAEMON_PATHS } from '../../core/paths';
import { MinioService } from '../../infrastructure/minio/MinioService';
import { inject, injectable } from 'tsyringe';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';

@injectable()
export class PluginBinaryCacheService {
    constructor(
        @inject(DAEMON_TOKENS.MinioService)
        private readonly minioService: MinioService
    ) {
    }

    async getBinaryPath(binaryObjectPath: string, binaryFileName?: string): Promise<string> {
        const fileName = binaryFileName || path.basename(binaryObjectPath);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, fileName);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            return localPath;
        } catch {
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

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
};
