import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';

@injectable()
export default class GetColoredModelController {
    constructor(
        @inject(GetColoredModelStreamUseCase)
        private readonly useCase: GetColoredModelStreamUseCase
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { property, startValue, endValue, gradient, timestep, exposureId } = req.query;

            const stream = await this.useCase.execute(
                String(trajectoryId),
                String(timestep),
                String(property),
                Number(startValue),
                Number(endValue),
                String(gradient),
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
