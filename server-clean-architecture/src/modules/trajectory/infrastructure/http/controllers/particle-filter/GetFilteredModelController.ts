import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';

@injectable()
export default class GetFilteredModelController {
    constructor(
        @inject(GetFilteredModelStreamUseCase)
        private readonly useCase: GetFilteredModelStreamUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { property, operator, value, timestep, exposureId, action } = req.query;

            const stream = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                String(property),
                String(operator),
                String(value),
                action ? String(action) : undefined,
                analysisId ? String(analysisId) : undefined,
                exposureId ? String(exposureId) : undefined
            );

            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    };
}
