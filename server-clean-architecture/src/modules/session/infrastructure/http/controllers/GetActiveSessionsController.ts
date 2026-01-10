import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetActiveSessionsUseCase from '../../../application/use-cases/GetActiveSessionsUseCase';

@injectable()
export default class GetActiveSessionsController{
    constructor(
        private getActiveSessionsUseCase: GetActiveSessionsUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const result = await this.getActiveSessionsUseCase.execute({ userId: req.userId! });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, null, 200);
    }
};