import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import RevokeAllSessionsUseCase from '../../../application/use-cases/RevokeAllSessionsUseCase';

@injectable()
export default class RevokeAllSessionsController{
    constructor(
        private revokeAllSessionsUseCase: RevokeAllSessionsUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const result = await this.revokeAllSessionsUseCase.execute({
            token: req.token!,
            userId: req.userId!
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, null, 200);
    }
};