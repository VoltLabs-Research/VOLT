import { Response } from 'express';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default class GetMyAccountController{
    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        if(!req.user){
            return res.status(401).json({ error: 'Not authenticated' }) as unknown as void;
        }
        BaseResponse.success(res, {
            _id: req.userId,
            ...req.user.props
        });
    }
};