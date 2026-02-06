import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class GetParticleFilterPropertiesController {
    constructor(
        @inject(GetParticleFilterPropertiesUseCase)
        private readonly useCase: GetParticleFilterPropertiesUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep } = req.query;

            if (!timestep) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            const data = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                analysisId ? String(analysisId) : undefined
            );

            res.status(200).json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };
}
