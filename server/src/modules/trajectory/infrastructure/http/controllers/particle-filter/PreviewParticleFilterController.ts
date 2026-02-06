import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import { FilterExpression } from '@modules/trajectory/domain/port/IAtomPropertiesService';

@injectable()
export default class PreviewParticleFilterController {
    constructor(
        @inject(PreviewParticleFilterUseCase)
        private readonly useCase: PreviewParticleFilterUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep, property, operator, value, exposureId } = req.query;

            if (!timestep || !property || !operator || value === undefined) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            const expression: FilterExpression = {
                property: String(property),
                operator: operator as any,
                value: Number(value)
            };

            const result = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                expression,
                analysisId ? String(analysisId) : undefined,
                exposureId ? String(exposureId) : undefined
            );

            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    };
}
