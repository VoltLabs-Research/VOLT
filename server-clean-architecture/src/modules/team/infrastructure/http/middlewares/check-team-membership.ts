import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import HasAccessUseCase from '@modules/team/application/use-cases/team/HasAccessUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import logger from '@shared/infrastructure/logger';

export const checkTeamMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const teamId = req.params.teamId;
    const userId = req.userId!;

    logger.debug(`check-team-membership: teamId=${teamId} & userId=${userId}`);

    if (!userId || !teamId) {
        return res.status(400).json({ status: 'error' });
    }

    const useCase = container.resolve(HasAccessUseCase);
    const teamIdStr = String(teamId);
    const result = await useCase.execute({ userId, teamId: teamIdStr });
    if (!result.success) {
        BaseResponse.error(res, result.error.message, result.error.statusCode);
        return;
    }

    if (result.value) {
        return next();
    }

    return res.status(403).json({
        status: 'error',
        message: ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
    });
};