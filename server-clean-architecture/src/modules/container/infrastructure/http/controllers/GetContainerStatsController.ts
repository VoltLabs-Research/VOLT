import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetContainerStatsUseCase } from '../../../application/use-cases/GetContainerStatsUseCase';

@injectable()
export class GetContainerStatsController {
    constructor(
        @inject(GetContainerStatsUseCase) private useCase: GetContainerStatsUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await this.useCase.execute({ id: String(id) });

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
