import { ErrorCodes } from '@core/constants/error-codes';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { readTrajectoryPreview } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { TrajectoryPreviewResult } from '@modules/trajectory/services/TrajectoryServiceTypes';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const DASHBOARD_MAX_WIDTH = 960;
const DASHBOARD_MAX_HEIGHT = 540;

/** Raster preview as stored by the rasterizer, inlined as a data URL. */
export const createPreviewOutput = (buffer: Buffer): TrajectoryPreviewResult => ({
    base64: `data:image/png;base64,${buffer.toString('base64')}`,
    etag: `"${createHash('sha256').update(buffer).digest('hex')}"`
});

/** Downscaled variant for dashboard cards, which never need the full frame. */
const createDashboardPreviewOutput = async (buffer: Buffer): Promise<TrajectoryPreviewResult> => {
    const resized = await sharp(buffer)
        .resize(DASHBOARD_MAX_WIDTH, DASHBOARD_MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

    return createPreviewOutput(resized);
};

export const getTrajectoryPreview = async (trajectoryId: string): Promise<TrajectoryPreviewResult> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
    if (!trajectory) {
        throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404);
    }

    const preview = await readTrajectoryPreview({
        trajectoryId,
        storageClusterId: trajectory.storageClusterId,
        objectGatewayClient,
        createOutput: createDashboardPreviewOutput
    });
    if (!preview) {
        throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404);
    }

    return preview;
};
