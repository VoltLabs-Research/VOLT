import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class GetSimulationCellController {
    handle = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // TODO: Integrate with SimulationCellService when ported
            BaseResponse.error(res, 'Simulation cell not found', HttpStatus.NotFound);
        } catch (error) {
            next(error);
        }
    };
}
