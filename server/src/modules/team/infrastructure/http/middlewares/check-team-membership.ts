import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoles } from '@core/constants/system-roles';
import {
    getTeamMemberRolePermissions,
    isPopulatedTeamMemberRole
} from '@modules/team/domain/entities/team-member/TeamMember';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { container } from 'tsyringe';
import type { NextFunction, Response } from 'express';

interface TeamMembershipFilter {
    user: string;
    team: string;
};

interface TeamRolePermissionsPopulate {
    path: 'role';
    select: ['name', 'permissions', 'isSystem'];
};

const getRequestTeamPermissions = (role: Parameters<typeof getTeamMemberRolePermissions>[0]): string[] => {
    if (!isPopulatedTeamMemberRole(role)) {
        return [];
    }

    if (!role.isSystem || !role.name) {
        return getTeamMemberRolePermissions(role);
    }

    const canonicalSystemRole = Object.values(SystemRoles).find((systemRole) => systemRole.name === role.name);

    if (!canonicalSystemRole) {
        return getTeamMemberRolePermissions(role);
    }

    return canonicalSystemRole.permissions;
};

export const checkTeamMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const teamId = Array.isArray(req.params.teamId)
        ? req.params.teamId[0]
        : req.params.teamId;
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

    if (req.authType === AuthenticationType.SecretKey) {
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
    const filter: TeamMembershipFilter = {
        user: userId,
        team: teamId
    };
    const populate: TeamRolePermissionsPopulate = {
        path: 'role',
        select: ['name', 'permissions', 'isSystem']
    };
    const member = await repository.findOne(
        filter,
        { populate }
    );

    if (!member) {
        return BaseResponse.error(
            res,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            HttpStatus.Forbidden,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
        );
    }

    req.teamPermissions = getRequestTeamPermissions(member.props.role);

    next();
};
