import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';

@injectable()
export default class GetSimulationCellController {
    handle = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // TODO: Integrate with SimulationCellService when ported
            res.status(404).json({
                status: 'error',
                message: 'Simulation cell not found'
            });
        } catch (error) {
            next(error);
        }
    };
}
