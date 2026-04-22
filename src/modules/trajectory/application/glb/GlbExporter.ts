import { ObjectBucketName } from '@/contracts';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RasterizeTrajectoryRequest } from '@/contracts';
import type { TrajectoryRasterQueue } from '@/modules/trajectory/application/raster/TrajectoryRasterQueue';
import type { TrajectoryParser } from '@/modules/trajectory/application/parsing/TrajectoryParser';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import spatialAssembler from '@voltstack/spatial-assembler';

export interface GlbExporter {
    preprocessTrajectory(input: any): Promise<void>;
};

const queueAutoPreviewRasterization = async (
    trajectoryRasterQueue: TrajectoryRasterQueue,
    modelObjectKey: string,
    input: any
): Promise<void> => {
    const { ownerClusterId, teamId } = input;

    const queueInput: RasterizeTrajectoryRequest = {
        trajectoryId: input.trajectoryId,
        teamId,
        storageClusterId: ownerClusterId,
        config: {
            autoPreview: true,
            timestep: input.timestep
        }
    };

    await trajectoryRasterQueue.queueRasterizationJobs(queueInput);
    logger.info('Handled auto-preview rasterization enqueue for generated GLB');
};

@Service('glbExporter')
export class GlbExporter {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly trajectoryRasterQueue: TrajectoryRasterQueue
    ) {}

    async preprocessTrajectory(input: any): Promise<void> {
        await withNativeProcessingTempDir('trajectory-glb', async (tempDirectory) => {
            const tempGlbPath = path.join(tempDirectory, 'model.glb');
            const tempCompressedGlbPath = `${tempGlbPath}.zst`;
            const modelObjectKey = this.trajectoryParser.getModelObjectKey(input.trajectoryId, input.timestep);

            const parsed = await this.trajectoryParser.readFrame({
                trajectoryId: input.trajectoryId,
                timestep: input.timestep,
                ownerClusterId: input.ownerClusterId
            });
            const exported = spatialAssembler.generateGLBToFile(
                parsed.positions,
                parsed.types,
                parsed.min,
                parsed.max,
                tempGlbPath
            );
            if (!exported) {
                throw new Error('Failed to export trajectory GLB');
            }

            await compressFileWithZstd(tempGlbPath, tempCompressedGlbPath);
            const glbStats = await fs.stat(tempCompressedGlbPath);
            const ownerClusterId = input.ownerClusterId;
            if (!ownerClusterId) {
                throw new Error(`Missing GLB output owner cluster for trajectory ${input.trajectoryId}`);
            }

            await this.objectStore.putObjectStream({
                ownerClusterId,
                bucket: ObjectBucketName.Models,
                objectKey: modelObjectKey,
                stream: createReadStream(tempCompressedGlbPath),
                size: glbStats.size,
                metadata: {
                    'Content-Type': 'model/gltf-binary',
                    'Content-Encoding': 'zstd'
                }
            });

            try {
                await queueAutoPreviewRasterization(this.trajectoryRasterQueue, modelObjectKey, input);
            } catch (error) {
                logger.warn('Failed to enqueue auto-preview rasterization for generated GLB');
            }
        });
    }
}
