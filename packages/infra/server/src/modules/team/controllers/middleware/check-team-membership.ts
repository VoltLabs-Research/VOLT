import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/models/TeamMember';
import { HttpStatus } from '@shared/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import {
    HttpRequestTeamContextSource,
    setHttpRequestContextTeam,
    type HttpRequestTeamContext
} from '@shared/http/request-context';
import BaseResponse from '@shared/http/responses/BaseResponse';
import logger from '@shared/logger';
import { isRecord } from '@shared/utilities/type-guards';
import type { NextFunction, Response } from 'express';

const setRequestTeamContext = (
    request: AuthenticatedRequest,
    teamContext: HttpRequestTeamContext
): void => {
    request.teamRole = teamContext.role;

    if (request.requestContext) {
        request.requestContext.team = teamContext;
    }

    setHttpRequestContextTeam(teamContext);
};

const reusableTeamContext = (
    request: AuthenticatedRequest,
    teamId: string,
    userId?: string
): HttpRequestTeamContext | null => {
    const requestTeamContext = request.requestContext?.team;

    if (!requestTeamContext || requestTeamContext.teamId !== teamId) {
        return null;
    }

    if (request.authType === AuthenticationType.SecretKey || requestTeamContext.userId === userId) {
        return requestTeamContext;
    }

    return null;
};

const readRequestTeamId = (req: AuthenticatedRequest): string | undefined => {
    const fromPath = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
    if (fromPath) {
        return fromPath;
    }

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

    const reusable = reusableTeamContext(req, teamId, userId);
    if (reusable) {
        req.teamRole = reusable.role;

        logger.debug(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} userId=${userId} durationMs=${Date.now() - startedAt}`);
        next();
        return;
    }

    if (req.authType === AuthenticationType.SecretKey) {
        // authentication set the key's role; a key only ever speaks for the team it was made in.
        if (req.secretKeyTeamId !== teamId || !req.teamRole) {
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
            role: req.teamRole
        };

        setRequestTeamContext(req, teamContext);
        logger.info(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} source=${teamContext.source} role=${teamContext.role} durationMs=${teamContext.durationMs}`);

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
        select: {
 id: true, role: true 
}
    });

    if (!member) {
        return BaseResponse.error(
            res,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            HttpStatus.Forbidden,
            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
        );
    }

    const teamContext: HttpRequestTeamContext = {
        teamId,
        userId,
        durationMs: Date.now() - startedAt,
        cached: false,
        source: HttpRequestTeamContextSource.Repository,
        role: member.role
    };

    setRequestTeamContext(req, teamContext);
    logger.info(`@check-team-membership traceId=${req.requestContext?.traceId} teamId=${teamId} userId=${userId} role=${member.role}`);

    next();
};
