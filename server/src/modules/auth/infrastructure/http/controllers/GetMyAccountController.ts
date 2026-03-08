import { Response } from 'express';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import User from '@modules/auth/domain/entities/User';

export default class GetMyAccountController{
    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        if (!req.userId || !req.user || typeof req.user !== 'object' || !('props' in req.user)) {
            BaseResponse.error(res, 'Authentication::Unauthorized', 401, 'Authentication::Unauthorized');
            return;
        }

        const user = req.user as User & {
            props: {
                firstName: string;
                lastName: string;
                [key: string]: unknown;
            };
        };
        const fullName = `${user.props.firstName} ${user.props.lastName}`.trim();
        const userId = user._id || req.userId;

        BaseResponse.success(res, {
            _id: userId,
            ...user.props,
            fullName
        });
    }
};
