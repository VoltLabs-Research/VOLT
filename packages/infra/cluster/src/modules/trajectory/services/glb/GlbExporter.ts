import { singleton } from '@shared/utilities/singleton';
import { getObjectStore } from '@shared/storage/ClusterObjectStore';
import { getTrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import { getTrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import { logger } from '@shared/logger';
import type { RasterizeTrajectoryRequest } from '@shared/contracts/types/queue-trajectory';
import type { TrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import type { TrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { putModel } from '@shared/storage/model-objects';
import { encodeFrameModel } from '@modules/trajectory/services/glb/frame-model';

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
        const ownerClusterId = input.ownerClusterId;
        if (!ownerClusterId) {
            throw new Error(`Missing GLB output owner cluster for trajectory ${input.trajectoryId}`);
        }

        const parsed = await this.trajectoryParser.readFrame({
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            ownerClusterId
        });
        await putModel(
            this.objectStore,
            ownerClusterId,
            this.trajectoryParser.getModelObjectKey(input.trajectoryId, input.timestep),
            encodeFrameModel(parsed.positions, parsed.types)
        );

        try {
            await queueAutoPreviewRasterization(this.trajectoryRasterQueue, input);
        } catch {
            logger.warn('Failed to enqueue auto-preview rasterization for generated GLB');
        }
    }
}

export const getGlbExporter = singleton((): GlbExporter => new GlbExporter(getObjectStore(), getTrajectoryParser(), getTrajectoryRasterQueue()));
