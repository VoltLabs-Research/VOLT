import { ErrorCodes } from '@core/constants/error-codes';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class TrajectoryReadAccessService {
    constructor(
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly teamMemberRepository: TeamMemberRepository
    ) {}

    async assertReadable(trajectoryId: string, userId?: string): Promise<Trajectory> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        if (trajectory.props.isPublic) {
            return trajectory;
        }

        if (!userId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'Team membership required to access this trajectory'
            );
        }

        const membership = await this.teamMemberRepository.findOne({
            team: String(trajectory.props.team),
            user: userId
        });

        if (!membership) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'Team membership required to access this trajectory'
            );
        }

        return trajectory;
    }
}
