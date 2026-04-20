import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export class TrajectoryReadAccessService {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
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
};
