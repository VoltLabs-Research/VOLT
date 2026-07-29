import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';

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

export class PipelineSharedExposureStore {
    constructor(private readonly objectStore: ClusterObjectStore) {}

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

        return {
            objectKey,
            ext
        };
    }

    async fetch(input: FetchSharedExposureInput): Promise<string | null> {
        const objectKey = await this.findObjectKey(input);
        if (!objectKey) {
            return null;
        }

        const destinationPath = path.join(
            input.destinationDir,
            `${input.exposureId}__${path.basename(objectKey)}`
        );
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

export const getPipelineSharedExposureStore = singleton((): PipelineSharedExposureStore => new PipelineSharedExposureStore(getObjectStore()));
