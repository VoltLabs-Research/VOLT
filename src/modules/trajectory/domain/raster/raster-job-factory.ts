import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type {
    RasterJobMetadata,
    RasterQueueJobPayload,
    RasterizeTrajectoryRequest
} from '@/modules/trajectory/contracts/queue-trajectory';

export interface ParsedRasterModel {
    modelObjectKey: string;
    outputObjectKey: string;
    timestep: number;
    analysisId?: string;
    model?: string;
}

const buildRasterJobId = (trajectoryId: string, rasterModel: ParsedRasterModel): string => {
    if (rasterModel.analysisId && rasterModel.model) {
        return `trajectory-raster_${trajectoryId}_${rasterModel.analysisId}_${rasterModel.timestep}_${rasterModel.model}`;
    }
    return `trajectory-raster_${trajectoryId}_${rasterModel.timestep}`;
};

const buildRasterJobMetadata = (
    input: RasterizeTrajectoryRequest,
    rasterModel: ParsedRasterModel,
    autoPreview: boolean
): RasterJobMetadata => ({
    trajectoryId: input.trajectoryId,
    timestep: rasterModel.timestep,
    analysisId: rasterModel.analysisId,
    model: rasterModel.model,
    autoPreview
});

export const buildRasterJobPayload = (
    input: RasterizeTrajectoryRequest,
    rasterModel: ParsedRasterModel,
    options: { autoPreview?: boolean } = {}
): RasterQueueJobPayload => {
    const autoPreview = options.autoPreview ?? false;
    const timestamp = new Date().toISOString();

    return {
        jobId: buildRasterJobId(input.trajectoryId, rasterModel),
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        timestep: rasterModel.timestep,
        modelObjectKey: rasterModel.modelObjectKey,
        modelOwnerClusterId: input.storageClusterId,
        outputObjectKey: rasterModel.outputObjectKey,
        outputOwnerClusterId: input.storageClusterId,
        status: 'queued',
        queueType: TRAJECTORY_RASTER_QUEUE_NAME,
        metadata: buildRasterJobMetadata(input, rasterModel, autoPreview),
        createdAt: timestamp,
        updatedAt: timestamp
    };
};
