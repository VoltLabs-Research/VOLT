import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { CreateAnalysisUseCase } from '@modules/analysis/application/use-cases/CreateAnalysisUseCase';

import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

@injectable()
export class CreateAnalysisController {
    constructor(
        @inject(CreateAnalysisUseCase) private useCase: CreateAnalysisUseCase
    ) { }

    async handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId!;
            const { trajectoryId, pluginSlug, config, teamId } = req.body;

            const result = await this.useCase.execute({
                trajectoryId,
                pluginSlug,
                config,
                userId,
                teamId
            });

            if (result.success) {
                res.status(201).json({
                    status: 'success',
                    data: result.value
                });
            } else {
                next(result.error);
            }
        } catch (error) {
            next(error);
        }
    }
}
