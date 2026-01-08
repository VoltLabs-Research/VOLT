import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import { Trajectory } from '@/models';
import colorCodingService from '@/services/color-coding';

export default class ColorCodingController extends BaseController<any> {
    constructor() {
        super(Trajectory, { resource: Resource.COLOR_CODING });
    }

    public getProperties = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if (!timestep) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const data = await colorCodingService.getProperties(
            trajectoryId,
            String(timestep),
            analysisId
        );

        return res.status(200).json({
            status: 'success',
            data
        });
    });

    public getStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, property, type, exposureId } = req.query;

        if (!timestep || !property || !type) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const stats = await colorCodingService.getStats(
            trajectoryId,
            String(timestep),
            String(property),
            String(type),
            analysisId,
            exposureId ? String(exposureId) : undefined
        );

        return res.status(200).json({ status: 'success', data: stats });
    });

    public create = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;
        const { property, exposureId, startValue, endValue, gradient } = req.body;

        if (!timestep || !property || startValue === undefined || endValue === undefined || !gradient) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        await colorCodingService.createColoredModel(
            trajectoryId,
            String(timestep),
            String(property),
            Number(startValue),
            Number(endValue),
            String(gradient),
            analysisId,
            exposureId
        );

        return res.status(200).json({ status: 'success' });
    }) as any;

    public get = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, startValue, endValue, gradient, timestep, exposureId } = req.query;

        const stream = await colorCodingService.getModelStream(
            trajectoryId,
            String(timestep),
            String(property),
            Number(startValue),
            Number(endValue),
            String(gradient),
            analysisId,
            exposureId ? String(exposureId) : undefined
        );

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        stream.pipe(res);
    });
}
