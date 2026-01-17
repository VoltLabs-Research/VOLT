import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetContainerByIdUseCase } from '../../../application/use-cases/GetContainerByIdUseCase';

@injectable()
export class GetContainerByIdController {
    constructor(
        @inject(GetContainerByIdUseCase) private useCase: GetContainerByIdUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await this.useCase.execute({ id: String(id) });

            if (result.success) {
                res.status(200).json({
                    status: 'success',
                    id: String(id),
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
