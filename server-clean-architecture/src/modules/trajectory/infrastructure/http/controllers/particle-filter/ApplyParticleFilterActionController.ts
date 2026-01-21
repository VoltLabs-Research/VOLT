import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import { FilterExpression } from '@modules/trajectory/domain/port/IAtomPropertiesService';

@injectable()
export default class ApplyParticleFilterActionController {
    constructor(
        @inject(ApplyParticleFilterActionUseCase)
        private readonly useCase: ApplyParticleFilterActionUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep, action } = req.query;
            const { property, operator, value, exposureId } = req.body;

            if (!timestep || !action || !property || !operator || value === undefined) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            if (action !== 'delete' && action !== 'highlight') {
                throw new RuntimeError(ErrorCodes.PARTICLE_FILTER_INVALID_ACTION, 400);
            }

            const expression: FilterExpression = {
                property: String(property),
                operator: operator as any,
                value: Number(value)
            };

            const result = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                action as 'delete' | 'highlight',
                expression,
                analysisId ? String(analysisId) : undefined,
                exposureId
            );

            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    };
}
