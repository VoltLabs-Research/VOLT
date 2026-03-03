import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class GetSimulationCellController {
    handle = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            BaseResponse.error(res, 'GetSimulationCell is not yet available. Use FindCellById or FindCellsByTeamId instead.', HttpStatus.NotFound);
        } catch (error) {
            next(error);
        }
    };
}
