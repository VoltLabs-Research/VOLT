import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { DAEMON_PATHS } from '@core/config/paths';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { toPluginExposureParquetObjectKey } from '@shared/infrastructure/storage/storage-codec';
import type {
    PluginModifierAnalysisRequest,
    PluginPropertyNamesRequest
} from '@modules/plugin/services/properties/PluginPropertyStore';
import { sweepPluginParquetCache } from '@modules/plugin/services/properties/parquet-cache-eviction';


const pluginAnalysisPrefix = (trajectoryId: string, analysisId: string): string =>
    `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`;

export const extractExposureId = (
    trajectoryId: string,
    analysisId: string,
    objectKey: string
): string | null => {
    const prefix = pluginAnalysisPrefix(trajectoryId, analysisId);
    if (!objectKey.startsWith(prefix)) return null;
    const relativePath = objectKey.slice(prefix.length);
    const slashIndex = relativePath.indexOf('/');
    return slashIndex > 0 ? relativePath.slice(0, slashIndex) : null;
};

const cacheIdFor = (ownerClusterId: string, objectKey: string): string =>
    createHash('sha256').update(`${ownerClusterId}::${objectKey}`).digest('hex');

export class ExposureParquetCache {
    private readonly downloadsInFlight = new Map<string, Promise<string>>();

    public constructor(private readonly objectStore: ClusterObjectStore) {}

    public async resolveExposureFile(request: PluginModifierAnalysisRequest): Promise<string> {
        const atomsKey = toPluginExposureParquetObjectKey(
            request.trajectoryId,
            request.analysisId,
            request.exposureId,
            request.timestep,
            'atoms'
        );
        try {
            return await this.resolveObject(request.ownerClusterId, atomsKey);
        } catch {
            const linesKey = toPluginExposureParquetObjectKey(
                request.trajectoryId,
                request.analysisId,
                request.exposureId,
                request.timestep,
                'lines'
            );
            return this.resolveObject(request.ownerClusterId, linesKey);
        }
    }

    public async resolveAnyExposureFile(request: PluginPropertyNamesRequest): Promise<string | null> {
        const prefix = `${pluginAnalysisPrefix(request.trajectoryId, request.analysisId)}${request.exposureId}/`;
        const keys = await this.listObjectKeys(request.ownerClusterId, prefix);
        const objectKey = keys.find((key) => key.endsWith('.parquet'));
        if (!objectKey) return null;
        return this.resolveObject(request.ownerClusterId, objectKey);
    }

    public listAnalysisObjectKeys(
        ownerClusterId: string,
        trajectoryId: string,
        analysisId: string
    ): Promise<string[]> {
        return this.listObjectKeys(ownerClusterId, pluginAnalysisPrefix(trajectoryId, analysisId));
    }

    public invalidate(ownerClusterId: string, objectKey: string): void {
        this.downloadsInFlight.delete(`${ownerClusterId}::${objectKey}`);
    }

    private async listObjectKeys(ownerClusterId: string, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.objectStore.list(ownerClusterId, {
                bucket: ObjectBucketName.Plugins,
                prefix,
                cursor,
                limit: 200
            });
            keys.push(...page.keys);
            cursor = page.nextCursor;
        } while (cursor);

        return keys;
    }

    private async resolveObject(ownerClusterId: string, objectKey: string): Promise<string> {
        const cacheKey = `${ownerClusterId}::${objectKey}`;
        const existing = this.downloadsInFlight.get(cacheKey);
        if (existing) return existing;

        const promise = this.downloadIfNeeded(ownerClusterId, objectKey);
        this.downloadsInFlight.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            this.downloadsInFlight.delete(cacheKey);
        }
    }

    private async downloadIfNeeded(ownerClusterId: string, objectKey: string): Promise<string> {
        await fs.mkdir(DAEMON_PATHS.pluginParquetCache, { recursive: true });
        const filePath = path.join(
            DAEMON_PATHS.pluginParquetCache,
            `${cacheIdFor(ownerClusterId, objectKey)}.parquet`
        );
        const signaturePath = `${filePath}.signature`;

        const head = await this.objectStore.head(ownerClusterId, ObjectBucketName.Plugins, objectKey);
        const signature = head.etag
            ?? `${head.contentLength ?? 0}:${head.lastModified?.getTime() ?? 0}`;

        try {
            const [existingSignature] = await Promise.all([
                fs.readFile(signaturePath, 'utf8'),
                fs.access(filePath)
            ]);
            if (existingSignature === signature) {
                const touchedAt = new Date();
                await fs.utimes(filePath, touchedAt, touchedAt).catch(() => {});
                void sweepPluginParquetCache();
                return filePath;
            }
        } catch {
        }

        const response = await this.objectStore.getStream(
            ownerClusterId,
            ObjectBucketName.Plugins,
            objectKey,
            { skipMetadata: true }
        );
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await pipeline(response.stream, createWriteStream(tempPath));
        await fs.rename(tempPath, filePath);
        await fs.writeFile(signaturePath, signature);
        logger.debug(`@plugin-property-store: cached ${objectKey} at ${filePath}`);
        void sweepPluginParquetCache();
        return filePath;
    }
}
