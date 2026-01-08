import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import { Trajectory } from '@/models';
import { FilterExpression } from '@/services/trajectory/atom-properties';
import particleFilterService from '@/services/particle-filter';

export default class ParticleFilterController extends BaseController<any> {
    constructor() {
        super(Trajectory, { resource: Resource.PARTICLE_FILTER });
    }

    public getProperties = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if (!timestep) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const data = await particleFilterService.getProperties(
            trajectoryId,
            String(timestep),
            analysisId
        );

        return res.status(200).json({
            status: 'success',
            data
        });
    });

    public preview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, property, operator, value, exposureId } = req.query;

        if (!timestep || !property || !operator || value === undefined) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const expression: FilterExpression = {
            property: String(property),
            operator: operator as any,
            value: Number(value)
        };

        const result = await particleFilterService.preview(
            trajectoryId,
            String(timestep),
            expression,
            analysisId,
            exposureId ? String(exposureId) : undefined
        );

        return res.status(200).json({
            status: 'success',
            data: result
        });
    });

    public applyAction = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, action } = req.query;
        const { property, operator, value, exposureId } = req.body;

        if (!timestep || !action || !property || !operator || value === undefined) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        if (action !== 'delete' && action !== 'highlight') {
            return next(new RuntimeError(ErrorCodes.PARTICLE_FILTER_INVALID_ACTION, 400));
        }

        const expression: FilterExpression = {
            property: String(property),
            operator: operator as any,
            value: Number(value)
        };

        const result = await particleFilterService.applyAction(
            trajectoryId,
            String(timestep),
            action as 'delete' | 'highlight',
            expression,
            analysisId,
            exposureId
        );

        return res.status(200).json({
            status: 'success',
            data: result
        });
    });

    public get = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, operator, value, timestep, exposureId, action } = req.query;

        const stream = await particleFilterService.getModelStream(
            trajectoryId,
            String(timestep),
            String(property),
            String(operator),
            String(value),
            action ? String(action) : undefined,
            analysisId,
            exposureId ? String(exposureId) : undefined
        );

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        stream.pipe(res);
    });
}
