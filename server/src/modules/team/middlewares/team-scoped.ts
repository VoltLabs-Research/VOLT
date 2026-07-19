import { Action } from '@core/constants/permissions';
import { ErrorCodes } from '@core/constants/error-codes';
import { checkTeamMembership } from '@modules/team/middlewares/check-team-membership';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { RequestHandler, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';

const METHOD_ACTION: Record<string, Action> = {
    GET: Action.READ,
    HEAD: Action.READ,
    POST: Action.CREATE,
    PUT: Action.UPDATE,
    PATCH: Action.UPDATE,
    DELETE: Action.DELETE
};

export const teamScoped = (resource: string): RequestHandler =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        checkTeamMembership(req, res, () => {
            const action = METHOD_ACTION[req.method] ?? Action.READ;
            const permission = `${resource}:${action}`;
            const permissions = req.teamPermissions ?? [];

            if (permissions.includes('*') || permissions.includes(permission)) {
                next();
                return;
            }

            BaseResponse.error(
                res,
                `Missing permission: ${permission}`,
                HttpStatus.Forbidden,
                ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS
            );
        });
    };
