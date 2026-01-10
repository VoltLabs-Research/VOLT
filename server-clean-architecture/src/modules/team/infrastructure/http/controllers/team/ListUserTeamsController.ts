import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import ListUserTeamsUseCase from '@/src/modules/team/application/use-cases/team/ListUserTeamsUseCase';

@injectable()
export default class ListUserTeamsController{
    constructor(
        private useCase: ListUserTeamsUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const results = await this.useCase.execute({ userId: req.userId! });
        if(!results.success){
            return BaseResponse.error(res, results.error.message, results.error.statusCode);
        }
        BaseResponse.success(res, results, 200);
    }
};