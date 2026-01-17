import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetRasterFramePNGUseCase } from '../../../application/use-cases/GetRasterFramePNGUseCase';

@injectable()
export class GetRasterFramePNGController {
    constructor(
        @inject(GetRasterFramePNGUseCase) private useCase: GetRasterFramePNGUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const trajectoryId = String(req.params.trajectoryId);
            const timestep = String(req.params.timestep);

            const result = await this.useCase.execute({
                trajectoryId,
                timestep: parseInt(timestep)
            });

            if (result.success) {
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Length', result.value.length);
                res.status(200).send(result.value);
            } else {
                next(result.error);
            }
        } catch (error) {
            next(error);
        }
    }
}
