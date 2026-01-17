import { injectable, inject } from 'tsyringe';
import { Response, NextFunction } from 'express';
import { ListContainersUseCase } from '../../../application/use-cases/ListContainersUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

@injectable()
export class ListContainersController {
    constructor(
        @inject(ListContainersUseCase) private useCase: ListContainersUseCase
    ) { }

    async handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const teamId = req.params.teamId;
            const userId = req.userId!;

            const result = await this.useCase.execute({ teamId: teamId as string, userId });

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
