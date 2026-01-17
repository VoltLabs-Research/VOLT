import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { ReadContainerFileUseCase } from '../../../application/use-cases/ReadContainerFileUseCase';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export class ReadContainerFileController {
    constructor(
        @inject(ReadContainerFileUseCase) private useCase: ReadContainerFileUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { path } = req.query;

            if (!path || typeof path !== 'string') {
                throw ApplicationError.badRequest('CONTAINER_FILE_PATH_REQUIRED', 'Path query parameter is required');
            }

            const result = await this.useCase.execute({ id: String(id), path: String(path) });

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
