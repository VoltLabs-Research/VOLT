import controllers from '@modules/system/infrastructure/http/controllers';
import { ErrorCodes } from '@core/constants/error-codes';
import { UserRole } from '@modules/auth/domain/entities/User';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { NextFunction, Response } from 'express';

const requireAdminUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user as { props?: { role?: UserRole } } | undefined;

    if (user?.props?.role === UserRole.Admin) {
        next();
        return;
    }

    BaseResponse.error(
        res,
        ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
        HttpStatus.Forbidden,
        ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS
    );
};

export default createHttpModule({
    basePath: '/api/system',
    protected: true,
    middleware: requireAdminUser,
    routes: (router) => {
        router.get('/stats', controllers.getSystemStats.handle);
        router.get('/rbac', controllers.getRbacConfig.handle);
    }
});
