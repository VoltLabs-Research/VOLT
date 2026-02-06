import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';

@injectable()
export default class GetUniqueValuesController {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { property, timestep, maxValues, exposureId } = req.query;

            const values = await this.particleFilterService.getUniqueValues(
                String(trajectoryId),
                String(timestep),
                String(property),
                maxValues ? Number(maxValues) : 100,
                analysisId ? String(analysisId) : undefined,
                exposureId ? String(exposureId) : undefined
            );

            res.json({ values });
        } catch (error) {
            next(error);
        }
    };
}
