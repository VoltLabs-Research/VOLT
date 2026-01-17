import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetContainerFilesUseCase } from '../../../application/use-cases/GetContainerFilesUseCase';

@injectable()
export class GetContainerFilesController {
    constructor(
        @inject(GetContainerFilesUseCase) private useCase: GetContainerFilesUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { path } = req.query;

            const result = await this.useCase.execute({
                id: String(id),
                path: typeof path === 'string' ? path : '/'
            });

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
