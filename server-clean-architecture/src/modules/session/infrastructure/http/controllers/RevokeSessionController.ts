import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import RevokeSessionUseCase from '../../../application/use-cases/RevokeSessionUseCase';

@injectable()
export default class RevokeSessionController{
    constructor(
        private revokeSessionUseCase: RevokeSessionUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const sessionId = req.params.id as string;
        const result = await this.revokeSessionUseCase.execute({
            sessionId,
            userId: req.userId!
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 200);
    }
};