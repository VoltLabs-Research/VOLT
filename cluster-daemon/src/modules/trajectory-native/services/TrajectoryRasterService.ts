import { ObjectBucketName, type RasterizeTrajectoryRequest } from '../../../shared/contracts';
import type { MinioService } from '../../platform/services';
import type { RasterizerService } from './RasterizerService';

export interface TrajectoryRasterService {
    rasterizeTrajectory(input: RasterizeTrajectoryRequest): Promise<{ triggered: boolean; }>;
}

export const createTrajectoryRasterService = (
    minioService: MinioService,
    rasterizerService: RasterizerService
): TrajectoryRasterService => ({
    async rasterizeTrajectory(input) {
        const prefix = `trajectory-${input.trajectoryId}/`;
        const keys = await minioService.listObjects(ObjectBucketName.Models, prefix);
        const glbKeys = keys.filter((key) => key.endsWith('.glb'));

        if (glbKeys.length === 0) {
            return {
                triggered: false
            };
        }

        for (const key of glbKeys) {
            const match = key.match(/timestep-(\d+)\.glb$/);
            if (!match) {
                continue;
            }

            const timestep = Number(match[1]);
            const previewObjectKey = `trajectory-${input.trajectoryId}/previews/timestep-${timestep}.png`;
            await rasterizerService.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: key,
                outputObjectKey: previewObjectKey
            });
        }

        return {
            triggered: true
        };
    }
});
