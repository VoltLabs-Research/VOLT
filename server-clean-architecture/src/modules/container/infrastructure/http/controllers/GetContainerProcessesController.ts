import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetContainerProcessesUseCase } from '../../../application/use-cases/GetContainerProcessesUseCase';

@injectable()
export class GetContainerProcessesController {
    constructor(
        @inject(GetContainerProcessesUseCase) private useCase: GetContainerProcessesUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = String(req.params.id);
            const result = await this.useCase.execute({ id });

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
