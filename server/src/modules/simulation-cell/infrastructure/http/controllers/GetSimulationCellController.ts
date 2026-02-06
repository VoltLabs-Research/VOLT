import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';

@injectable()
export default class GetSimulationCellController {
    handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, teamId } = req.params;

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
