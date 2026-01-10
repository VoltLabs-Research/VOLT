import { Response } from 'express';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

export default class GetMyAccountController{
    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        BaseResponse.success(res, req.user);
    }
};