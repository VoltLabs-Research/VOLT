import { Response } from 'express';
import { injectable } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import FindActivityByTeamIdUseCase from '../../../application/use-cases/FindActivityByTeamIdUseCase';

@injectable()
export default class FindActivityByTeamIdController{
    constructor(
        private useCase: FindActivityByTeamIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const range = parseInt(req.query.range as string ?? '365');
        const result = await this.useCase.execute({ teamId, range });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 200);
    }
};