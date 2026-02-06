import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class GetColorCodingStatsController {
    constructor(
        @inject(GetColorCodingStatsUseCase)
        private readonly useCase: GetColorCodingStatsUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep, property, type, exposureId } = req.query;

            if (!timestep || !property || !type) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            const stats = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                String(property),
                String(type),
                analysisId ? String(analysisId) : undefined,
                exposureId ? String(exposureId) : undefined
            );

            res.status(200).json({ status: 'success', data: stats });
        } catch (error) {
            next(error);
        }
    };
}
