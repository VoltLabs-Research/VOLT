import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { UpdateAnalysisByIdUseCase } from '@modules/analysis/application/use-cases/UpdateAnalysisByIdUseCase';

@injectable()
export class UpdateAnalysisByIdController {
    constructor(
        @inject(UpdateAnalysisByIdUseCase) private useCase: UpdateAnalysisByIdUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = String(req.params.id);
            const { config } = req.body;

            const result = await this.useCase.execute({ id, config });

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
