import { Response } from 'express';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default class GetMyAccountController{
    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const fullName = `${req.user.props.firstName} ${req.user.props.lastName}`.trim();

        BaseResponse.success(res, {
            _id: req.userId,
            ...req.user.props,
            fullName
        });
    }
};