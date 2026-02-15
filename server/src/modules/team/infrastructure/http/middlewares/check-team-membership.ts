import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamMemberRepository';
import logger from '@shared/infrastructure/logger';

export const checkTeamMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const teamId = req.params.teamId;
    const userId = req.userId!;

    logger.debug(`check-team-membership: teamId=${teamId} & userId=${userId}`);

    if (!userId || !teamId) {
        return res.status(400).json({ status: 'error' });
    }

    const repository = container.resolve(TeamMemberRepository);
    const member = await repository.findOne({ user: userId, team: teamId });

    if(!member){
        return res.status(403).json({
            status: 'error',
            message: ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN
        });
    }

    next();
};