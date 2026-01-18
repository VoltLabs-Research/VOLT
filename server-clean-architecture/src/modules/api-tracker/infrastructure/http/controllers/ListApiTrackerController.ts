import { injectable, inject } from 'tsyringe';
import { Response, NextFunction } from 'express';
import { ListApiTrackerUseCase } from '@modules/api-tracker/application/use-cases/ListApiTrackerUseCase';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

@injectable()
export class ListApiTrackerController {
    constructor(
        @inject(ListApiTrackerUseCase) private useCase: ListApiTrackerUseCase
    ) { }

    async handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId!;
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

            const result = await this.useCase.execute({ userId, page, limit });

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
