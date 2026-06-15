import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Service } from '@/core/decorators/service';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';

// Shared-exposure files produced by a computing plugin stage are persisted under
// a deterministic key so a later analysis whose pipeline cache-hits this stage
// can re-fetch them. The files are opaque (often plain-text `.table` files), so
// they ride as raw bytes through putObjectStream / getStream — no parquet codec.
const sharedExposureKey = (
    trajectoryId: string,
    analysisId: string,
    exposureId: string,
    timestep: number,
    ext: string
): string =>
    `${sharedExposurePrefix(trajectoryId, analysisId, exposureId)}timestep-${timestep}.${ext}`;

const sharedExposurePrefix = (
    trajectoryId: string,
    analysisId: string,
    exposureId: string
): string =>
    `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/shared-${exposureId}/`;

export interface PersistSharedExposureInput {
    ownerClusterId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    sourcePath: string;
}

export interface FetchSharedExposureInput {
    ownerClusterId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    destinationDir: string;
}

@Service('pipelineSharedExposureStore')
export class PipelineSharedExposureStore {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    // Returns the file extension under which the exposure was stored.
    async persist(input: PersistSharedExposureInput): Promise<{ objectKey: string; ext: string }> {
        const ext = this.resolveExt(input.sourcePath);
        const objectKey = sharedExposureKey(
            input.trajectoryId,
            input.analysisId,
            input.exposureId,
            input.timestep,
            ext
        );
        const stat = await fs.stat(input.sourcePath);

        await this.objectStore.putObjectStream({
            ownerClusterId: input.ownerClusterId,
            bucket: ObjectBucketName.Plugins,
            objectKey,
            stream: createReadStream(input.sourcePath),
            size: stat.size
        });

        return { objectKey, ext };
    }

    // Fetches the cached shared-exposure file for a (source analysis, exposure,
    // timestep) into destinationDir, preserving the original basename. The stored
    // extension is unknown to the caller, so the matching object is discovered by
    // listing the exposure prefix. Returns the local path, or null if absent.
    async fetch(input: FetchSharedExposureInput): Promise<string | null> {
        const objectKey = await this.findObjectKey(input);
        if (!objectKey) {
            return null;
        }

        const destinationPath = path.join(input.destinationDir, path.basename(objectKey));
        const response = await this.objectStore.getStream(
            input.ownerClusterId,
            ObjectBucketName.Plugins,
            objectKey,
            { skipMetadata: true }
        );
        await fs.mkdir(input.destinationDir, { recursive: true });
        await pipeline(response.stream, createWriteStream(destinationPath));
        return destinationPath;
    }

    private async findObjectKey(input: FetchSharedExposureInput): Promise<string | null> {
        const prefix = sharedExposurePrefix(input.trajectoryId, input.analysisId, input.exposureId);
        const marker = `timestep-${input.timestep}.`;
        let cursor: string | undefined;

        do {
            const page = await this.objectStore.list(input.ownerClusterId, {
                bucket: ObjectBucketName.Plugins,
                prefix,
                cursor,
                limit: 200
            });
            const match = page.keys.find((key) => path.basename(key).startsWith(marker));
            if (match) {
                return match;
            }
            cursor = page.nextCursor;
        } while (cursor);

        return null;
    }

    private resolveExt(sourcePath: string): string {
        const ext = path.extname(sourcePath);
        return ext.startsWith('.') ? ext.slice(1) : ext;
    }
}
