import { ErrorCodes } from '@core/constants/error-codes';
import { checkTeamMembership } from '@modules/team/controllers/middleware/check-team-membership';
import { HttpStatus } from '@shared/http/constants/HttpStatus';
import BaseResponse from '@shared/http/responses/BaseResponse';
import {
    TeamAccess,
    hasTeamRole,
    requiredTeamRole,
    teamRoleLabel,
    type TeamArea
} from '@volt/contracts/modules/team/access';
import type { RequestHandler, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';

const READ_METHODS = new Set(['GET', 'HEAD']);

// Lets a team member through when their role may read (GET, HEAD) or change (anything else) the
// area. Which role that is comes from the table in @volt/contracts/modules/team/access.
export const teamScoped = (area: TeamArea): RequestHandler =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        checkTeamMembership(req, res, () => {
            const access = READ_METHODS.has(req.method) ? TeamAccess.Read : TeamAccess.Write;
            const required = requiredTeamRole(area, access);

            if (hasTeamRole(req.teamRole, required)) {
                next();
                return;
            }

            BaseResponse.error(
                res,
                `This needs the ${teamRoleLabel(required)} role or higher`,
                HttpStatus.Forbidden,
                ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS
            );
        });
    };
