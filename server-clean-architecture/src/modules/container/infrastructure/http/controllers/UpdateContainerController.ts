import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { UpdateContainerUseCase } from '../../../application/use-cases/UpdateContainerUseCase';

@injectable()
export class UpdateContainerController {
    constructor(
        @inject(UpdateContainerUseCase) private useCase: UpdateContainerUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { action, env, ports } = req.body;

            const result = await this.useCase.execute({
                id: String(id),
                action,
                env,
                ports
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
