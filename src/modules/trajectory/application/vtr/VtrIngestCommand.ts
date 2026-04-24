import { Command, CommandGroup } from '@/core/commands/decorators';
import { logger } from '@/core/logger';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type { VtrIngestService } from '@/modules/trajectory/application/vtr/VtrIngestService';
import { createZstdDecompressionStream, isZstdObjectKey } from '@/support/serialization/storage-codec';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

// Why: this command is the single entry point from the server to produce a
// canonical .vtr for a trajectory. The server pushes all dump.zst frames to
// the daemon's MinIO first (existing compression/upload pipeline) and then
// fires this command — the daemon decompresses each frame in a temp dir and
// hands them to VtrIngestService which writes the .vtr back to MinIO.

interface VtrIngestCommandFrameInput {
    timestep: number;
    objectKey: string;
}

interface VtrIngestCommandPayload {
    trajectoryId: string;
    ownerClusterId: string;
    frames: VtrIngestCommandFrameInput[];
    lossless?: boolean;
    keyframeInterval?: number;
    useDedup?: boolean;
    zstdLevel?: number;
    customProperties?: string[];
}

interface VtrIngestCommandResponse {
    objectKey: string;
    frameCount: number;
    size: number;
    bucket: ObjectBucketName;
}

@CommandGroup('trajectory.vtr')
export class VtrIngestCommand {
    public constructor(
        private readonly vtrIngestService: VtrIngestService,
        private readonly objectStore: ClusterObjectStore
    ) {}

    @Command('ingest')
    public async ingest(payload: VtrIngestCommandPayload): Promise<VtrIngestCommandResponse> {
        if (!payload.ownerClusterId) {
            throw new Error('vtr ingest requires ownerClusterId');
        }
        if (payload.frames.length === 0) {
            throw new Error(`vtr ingest requires at least one frame (trajectoryId=${payload.trajectoryId})`);
        }

        return withNativeProcessingTempDir('vtr-ingest-download', async (tempDirectory) => {
            const localFrames: { timestep: number; dumpPath: string }[] = [];

            for (const frame of payload.frames) {
                const response = await this.objectStore.getStream(
                    payload.ownerClusterId,
                    ObjectBucketName.Dumps,
                    frame.objectKey,
                    { skipMetadata: true }
                );
                const localPath = path.join(tempDirectory, `timestep-${frame.timestep}.dump`);
                if (isZstdObjectKey(frame.objectKey)) {
                    const decompressed = createZstdDecompressionStream(response.stream);
                    await pipeline(decompressed.stream, createWriteStream(localPath));
                    await decompressed.completion;
                } else {
                    await pipeline(response.stream, createWriteStream(localPath));
                }
                localFrames.push({ timestep: frame.timestep, dumpPath: localPath });
            }

            logger.info(`@vtr-ingest-command: downloaded ${localFrames.length} frames for trajectoryId=${payload.trajectoryId}`);

            const result = await this.vtrIngestService.ingest({
                trajectoryId: payload.trajectoryId,
                ownerClusterId: payload.ownerClusterId,
                frames: localFrames,
                lossless: payload.lossless ?? true,
                keyframeInterval: payload.keyframeInterval,
                useDedup: payload.useDedup,
                zstdLevel: payload.zstdLevel,
                customProperties: payload.customProperties
            });

            return {
                objectKey: result.objectKey,
                frameCount: result.frameCount,
                size: result.size,
                bucket: result.bucket
            };
        });
    }
}
