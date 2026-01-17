import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { TriggerRasterizationUseCase } from '../../../application/use-cases/TriggerRasterizationUseCase';

@injectable()
export class TriggerRasterizationController {
    constructor(
        @inject(TriggerRasterizationUseCase) private useCase: TriggerRasterizationUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const trajectoryId = String(req.params.trajectoryId);
            const { config } = req.body;

            const result = await this.useCase.execute({ trajectoryId, config });

            if (result.success) {
                res.status(200).json({
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
