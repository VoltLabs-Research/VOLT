import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { logger } from '@shared/infrastructure/logger';
import { DAEMON_PATHS } from '@core/config/paths';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { buildArtifactCacheKey } from '@modules/plugin/services/binaries/runtime-cache-keys';

/** Downloads artifacts into the local bin cache, verifying the sha256 published with them. */

const HASH_MARKER_FILENAME_SUFFIX = '.sha256';

export interface PluginArtifactSource {
    ownerClusterId: string;
    expectedHash?: string;
}

const computeFileHash = async (filePath: string): Promise<string> => {
    const hash = createHash('sha256');

    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }

    return hash.digest('hex');
};

export class PluginArtifactDownloader {
    private readonly downloadsInFlight = new Map<string, Promise<string>>();

    public constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly defaultOwnerClusterId: string
    ) {}

    public async resolveSource(
        binaryObjectPath: string,
        ownerClusterId?: string
    ): Promise<PluginArtifactSource> {
        const resolvedOwnerClusterId = ownerClusterId || this.defaultOwnerClusterId;
        const { metadata } = await this.objectStore.head(
            resolvedOwnerClusterId,
            ObjectBucketName.Plugins,
            binaryObjectPath
        );

        return {
            ownerClusterId: resolvedOwnerClusterId,
            expectedHash: metadata.sha256 || metadata['x-amz-meta-sha256'] || undefined
        };
    }

    public getLocalPath(binaryObjectPath: string, source: PluginArtifactSource): Promise<string> {
        const cacheKey = buildArtifactCacheKey(binaryObjectPath, source.ownerClusterId, source.expectedHash);
        const existingPromise = this.downloadsInFlight.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = this.fetchArtifact(binaryObjectPath, source, cacheKey)
            .finally(() => {
                this.downloadsInFlight.delete(cacheKey);
            });

        this.downloadsInFlight.set(cacheKey, nextPromise);
        return nextPromise;
    }

    private async fetchArtifact(
        binaryObjectPath: string,
        source: PluginArtifactSource,
        cacheKey: string
    ): Promise<string> {
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);
        const hashMarkerPath = `${localPath}${HASH_MARKER_FILENAME_SUFFIX}`;

        try {
            await fs.access(localPath, fs.constants.X_OK);
            const cachedHash = await fs.readFile(hashMarkerPath, 'utf-8').catch(() => null);
            if (!source.expectedHash || cachedHash === source.expectedHash) {
                return localPath;
            }

            logger.warn(
                {
                    action: 'artifact.resolve.hash-mismatch',
                    binaryObjectPath,
                    cacheKey,
                    cachedHash,
                    expectedHash: source.expectedHash
                },
                'Plugin binary cache hash mismatch, refetching'
            );
            await fs.rm(localPath, { force: true }).catch(() => {});
            await fs.rm(hashMarkerPath, { force: true }).catch(() => {});
        } catch {
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

        const tempPath = `${localPath}.partial-${process.pid}-${Date.now()}`;
        const response = await this.objectStore.getStream(
            source.ownerClusterId,
            ObjectBucketName.Plugins,
            binaryObjectPath,
            { skipMetadata: true }
        );

        try {
            await pipeline(response.stream, createWriteStream(tempPath));
            if (source.expectedHash) {
                const computedHash = await computeFileHash(tempPath);
                if (computedHash !== source.expectedHash) {
                    logger.error(
                        {
                            action: 'artifact.resolve.hash-mismatch',
                            binaryObjectPath,
                            computedHash,
                            expectedHash: source.expectedHash
                        },
                        'Downloaded plugin binary hash does not match expected hash'
                    );
                    throw new Error(`Downloaded plugin binary hash mismatch for ${binaryObjectPath}`);
                }
            }

            await fs.chmod(tempPath, 0o755);
            await fs.rename(tempPath, localPath);

            if (source.expectedHash) {
                await fs.writeFile(hashMarkerPath, source.expectedHash, 'utf-8');
            } else {
                await fs.rm(hashMarkerPath, { force: true }).catch(() => {});
            }
        } catch (error) {
            await fs.rm(tempPath, { force: true }).catch(() => {});
            throw error;
        }

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    }
}
