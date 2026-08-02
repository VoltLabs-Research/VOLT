import { ErrorCodes } from '@core/constants/error-codes';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { assertTeamMembership } from '@modules/team/services/team/team-membership-guard';
import ApplicationError from '@shared/application/errors/ApplicationError';

export default class TrajectoryAccessGuard{
    async assertReadable(trajectoryId: string, userId?: string): Promise<Trajectory>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        if(!trajectory) throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        if(trajectory.isPublic) return trajectory;

        await assertTeamMembership(trajectory.team, userId);

        return trajectory;
    }
}
