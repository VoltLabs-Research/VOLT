import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/TeamMember';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import logger from '@shared/infrastructure/logger';

export const checkTeamMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const teamId = req.params.teamId;
    const userId = req.userId;

    logger.debug(`check-team-membership: teamId=${teamId} & userId=${userId}`);

    if (!teamId) {
        return BaseResponse.error(
            res,
            ErrorCodes.TEAM_ID_REQUIRED,
            HttpStatus.BadRequest,
            ErrorCodes.TEAM_ID_REQUIRED
        );
    }

    if (req.authType === 'secret-key') {
        if (req.secretKeyTeamId !== teamId) {
            return BaseResponse.error(
                res,
                ErrorCodes.TEAM_ACCESS_DENIED,
                HttpStatus.Forbidden,
                ErrorCodes.TEAM_ACCESS_DENIED
            );
        }

        return next();
    }

    if (!userId) {
        return BaseResponse.error(
            res,
            ErrorCodes.AUTHENTICATION_REQUIRED,
            HttpStatus.Unauthorized,
            ErrorCodes.AUTHENTICATION_REQUIRED
        );
    }

    const repository = container.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository);
    const member = await repository.findOne(
        { user: userId, team: teamId as string },
        { populate: { path: 'role', select: ['permissions'] } }
    );

    if (!member) {
        return BaseResponse.error(
            res,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            HttpStatus.Forbidden,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
        );
    }

    req.teamPermissions = getTeamMemberRolePermissions(member.props.role);

    next();
};
