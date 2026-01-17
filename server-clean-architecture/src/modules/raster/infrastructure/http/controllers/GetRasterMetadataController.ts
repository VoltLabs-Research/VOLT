import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetRasterMetadataUseCase } from '../../../application/use-cases/GetRasterMetadataUseCase';

@injectable()
export class GetRasterMetadataController {
    constructor(
        @inject(GetRasterMetadataUseCase) private useCase: GetRasterMetadataUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const trajectoryId = String(req.params.trajectoryId);

            const result = await this.useCase.execute(trajectoryId);

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
