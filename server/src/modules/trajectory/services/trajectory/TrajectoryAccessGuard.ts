import { ErrorCodes } from '@core/constants/error-codes';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamMember from '@modules/team/models/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';

const membershipRequired = (): ApplicationError => ApplicationError.forbidden(
    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
    'Team membership required to access this trajectory'
);

export default class TrajectoryAccessGuard{
    async assertReadable(trajectoryId: string, userId?: string): Promise<Trajectory>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        if(!trajectory) throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        if(trajectory.isPublic) return trajectory;
        if(!userId) throw membershipRequired();

        const isMember = await TeamMember.existsBy({
            team: trajectory.team,
            user: userId
        });
        if(!isMember) throw membershipRequired();

        return trajectory;
    }
}
