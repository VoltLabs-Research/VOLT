import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';

@injectable()
export default class GetTrajectoriesByTeamIdController {
    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase) 
        private readonly useCase: GetTrajectoriesByTeamIdUseCase
    ) {}

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { teamId } = req.params;
            const { page, limit, search } = req.query;

            const result = await this.useCase.execute({
                teamId,
                page: page ? Number(page) : 1,
                limit: limit ? Number(limit) : 20,
                search: search as string | undefined
            });

            if(result.isFailure){
                return BaseResponse.error(res, result.error.message, result.error.statusCode || 500);
            }

            return BaseResponse.paginated(res, result.value);
        } catch(error) {
            next(error);
        }
    };
};