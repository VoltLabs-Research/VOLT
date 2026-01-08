import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { Trajectory } from '@/models';
import { RasterizerOptions } from '@/utilities/export/rasterizer';
import rasterService from '@/services/raster';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export default class RasterController {
    /**
     * Triggers the rasterization process for trajectory GLBs.
     */
    public rasterizeFrames = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const opts: Partial<RasterizerOptions> = req.body ?? {};

        await rasterService.processFrames(trajectory, opts);

        return res.status(200).json({ status: 'success' });
    });

    /**
     * Returns metadata about available rasterized frames for a trajectory.
     */
    public getRasterFrameMetadata = catchAsync(async (req: Request, res: Response) => {
        let trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();

        // Increment view counter (Controller responsibility: Updating view stats)
        trajectory = await Trajectory.findOneAndUpdate(
            { _id: trajectoryId },
            { $inc: { rasterSceneViews: 1 } },
            { new: true }
        );

        const { analyses } = await rasterService.getFrameMetadata(trajectory);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        res.setHeader('ETag', `"raster-meta-${trajectoryId}-${trajectory.rasterSceneViews}"`);

        return res.status(200).json({
            status: 'success',
            data: { trajectory, analyses }
        });
    });

    /**
     * Returns the base64-encoded PNG data for a specific frame.
     */
    public getRasterFrameData = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const { timestep, analysisId, model } = req.params;

        try {
            const result = await rasterService.getFrameData(trajectoryId, timestep, analysisId, model);

            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('ETag', result.etag);

            return res.status(200).json({
                status: 'success',
                data: {
                    model: result.model,
                    frame: result.frame,
                    analysisId: result.analysisId,
                    data: result.base64
                }
            });
        } catch (error: any) {
            if (error instanceof RuntimeError) {
                return res.status(error.statusCode).json({ status: 'error', message: error.message });
            } if (error.message.includes('not found')) { // Handle potential non-RuntimeErrors from service
                return res.status(404).json({ status: 'error', message: 'Raster image not found' });
            }
            throw error;
        }
    });
}
