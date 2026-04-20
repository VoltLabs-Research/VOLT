import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { PublicCanvasAccessMode } from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';

import type {
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    PublicCanvasBootstrapTrajectoryDTO
} from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';

const toBootstrapTrajectory = (trajectory: Trajectory): PublicCanvasBootstrapTrajectoryDTO => {
    return {
        _id: trajectory.id,
        name: trajectory.props.name,
        status: trajectory.props.status,
        isPublic: trajectory.props.isPublic,
        teamId: String(trajectory.props.team),
        analysisIds: trajectory.props.analysis ?? [],
        frames: trajectory.props.frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: String(frame.simulationCell)
        }))
    };
};

@injectable()
export class GetPublicCanvasBootstrapUseCase implements IUseCase<
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(
        input: GetPublicCanvasBootstrapInputDTO
    ): Promise<Result<GetPublicCanvasBootstrapOutputDTO, ApplicationError>> {
        const trajectory = await this.trajectoryRepository.findById(input.trajectoryId);

        if (!trajectory) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const teamId = String(trajectory.props.team);
        let hasTeamMembership = false;

        if (input.userId) {
            const membership = await this.teamMemberRepository.findOne({
                team: teamId,
                user: input.userId
            });
            hasTeamMembership = membership !== null;
        }

        if (!trajectory.props.isPublic && !hasTeamMembership) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'Team membership required to access this trajectory'
            ));
        }

        return Result.ok({
            access: {
                mode: PublicCanvasAccessMode.ReadOnly,
                isGuest: !input.userId,
                isPublic: trajectory.props.isPublic,
                hasTeamMembership
            },
            trajectory: toBootstrapTrajectory(trajectory)
        });
    }
};
