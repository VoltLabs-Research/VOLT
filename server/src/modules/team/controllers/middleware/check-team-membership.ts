import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoles } from '@core/constants/system-roles';
import TeamMember from '@modules/team/models/TeamMember';
import type TeamRole from '@modules/team/models/TeamRole';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import {
    HttpRequestTeamContextSource,
    setHttpRequestContextTeam,
    type HttpRequestTeamContext
} from '@shared/infrastructure/http/request-context';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type { NextFunction, Response } from 'express';

const getRequestTeamPermissions = (role?: TeamRole | null): string[] => {
    if(!role){
        return [];
    }

    if(!role.isSystem || !role.name){
        return role.permissions ?? [];
    }

    const canonicalSystemRole = Object.values(SystemRoles).find((systemRole) => systemRole.name === role.name);

    if(!canonicalSystemRole){
        return role.permissions ?? [];
    }

    return canonicalSystemRole.permissions;
};

const setRequestTeamContext = (
    request: AuthenticatedRequest,
    teamContext: HttpRequestTeamContext
): void => {
    if (request.requestContext) {
        request.requestContext.team = teamContext;
    }

    setHttpRequestContextTeam(teamContext);
};

const canReuseTeamMembershipContext = (
    request: AuthenticatedRequest,
    teamId: string,
    userId?: string
): boolean => {
    const requestTeamContext = request.requestContext?.team;

    if (!requestTeamContext || requestTeamContext.teamId !== teamId) {
        return false;
    }

    if (request.authType === AuthenticationType.SecretKey) {
        return true;
    }

    return requestTeamContext.userId === userId;
};

const readRequestTeamId = (req: AuthenticatedRequest): string | undefined => {
    // Express types a path param as `string | string[]`, so this narrowing is
    // load-bearing rather than defensive.
    const fromPath = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
    if (fromPath) {
        return fromPath;
    }

    // `req.body` is the one genuinely arbitrary shape here: a JSON array or
    // scalar body is legal, so it cannot be indexed without the record guard.
    const body: unknown = req.body;

    return isRecord(body) && typeof body.teamId === 'string' ? body.teamId : undefined;
};

export const checkTeamMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const teamId = readRequestTeamId(req);
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

    if (canReuseTeamMembershipContext(req, teamId, userId)) {
        req.teamPermissions = req.requestContext?.team?.permissions || [];

        logger.debug(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} userId=${userId} durationMs=${Date.now() - startedAt}`);
        next();
        return;
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

        const teamContext: HttpRequestTeamContext = {
            teamId,
            userId: req.userId,
            durationMs: Date.now() - startedAt,
            cached: false,
            source: HttpRequestTeamContextSource.SecretKey,
            permissions: req.teamPermissions || []
        };

        setRequestTeamContext(req, teamContext);
        logger.info(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} source=${teamContext.source} durationMs=${teamContext.durationMs}`);

        next();
        return;
    }

    if (!userId) {
        return BaseResponse.error(
            res,
            ErrorCodes.AUTHENTICATION_REQUIRED,
            HttpStatus.Unauthorized,
            ErrorCodes.AUTHENTICATION_REQUIRED
        );
    }

    const member = await TeamMember.findOne({
        where: {
            user: userId,
            team: teamId
        },
        relations: { roleRef: true }
    });

    if (!member) {
        return BaseResponse.error(
            res,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            HttpStatus.Forbidden,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
        );
    }

    req.teamPermissions = getRequestTeamPermissions(member.roleRef);

    const teamContext: HttpRequestTeamContext = {
        teamId,
        userId,
        durationMs: Date.now() - startedAt,
        cached: false,
        source: HttpRequestTeamContextSource.Repository,
        permissions: req.teamPermissions
    };

    setRequestTeamContext(req, teamContext);
    logger.info(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} userId=${userId} permissionsCount=${req.teamPermissions.length}`);

    next();
};
