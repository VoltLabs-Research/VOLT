import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class CreateColoredModelController {
    constructor(
        @inject(CreateColoredModelUseCase)
        private readonly useCase: CreateColoredModelUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep } = req.query;
            const { property, exposureId, startValue, endValue, gradient } = req.body;

            if (!timestep || !property || startValue === undefined || endValue === undefined || !gradient) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                String(property),
                Number(startValue),
                Number(endValue),
                String(gradient),
                analysisId ? String(analysisId) : undefined,
                exposureId
            );

            res.status(200).json({ status: 'success' });
        } catch (error) {
            next(error);
        }
    };
}
