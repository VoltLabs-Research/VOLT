import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getTrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import { getTrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { logger } from '@shared/infrastructure/logger';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RasterizeTrajectoryRequest } from '@shared/contracts/types/queue-trajectory';
import type { TrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import type { TrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { compressFileWithZstd } from '@shared/infrastructure/storage/storage-codec';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import spatialAssembler from '@voltstack/spatial-assembler';

interface PreprocessTrajectoryInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    teamId: string;
}

const queueAutoPreviewRasterization = async (
    trajectoryRasterQueue: TrajectoryRasterQueue,
    input: PreprocessTrajectoryInput
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

export class GlbExporter {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly trajectoryRasterQueue: TrajectoryRasterQueue
    ) {}

    async preprocessTrajectory(input: PreprocessTrajectoryInput): Promise<void> {
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
                await queueAutoPreviewRasterization(this.trajectoryRasterQueue, input);
            } catch {
                logger.warn('Failed to enqueue auto-preview rasterization for generated GLB');
            }
        });
    }
}

export const getGlbExporter = singleton((): GlbExporter => new GlbExporter(getObjectStore(), getTrajectoryParser(), getTrajectoryRasterQueue()));
