import { Action } from '@core/constants/permissions';
import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/container/infrastructure/http/controllers';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { NextFunction, Response } from 'express';

const CONTAINER_READ_PERMISSION = `${Resource.CONTAINER}:${Action.READ}`;

const requireContainerReadPermission = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    const permissions = req.teamPermissions || [];
    if (permissions.includes('*') || permissions.includes(CONTAINER_READ_PERMISSION)) {
        next();
        return;
    }

    BaseResponse.error(
        res,
        `Missing permission: ${CONTAINER_READ_PERMISSION}`,
        HttpStatus.Forbidden,
        ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS
    );
};

export default createHttpModule({
    basePath: '/api/container-xrdp/:teamId',
    protected: true,
    teamScope: HttpModuleTeamScope.BasePath,
    middleware: requireContainerReadPermission,
    routes: (router) => {
        router.post('/:containerId/session', controllers.createXrdpSession.handle);
    }
});
