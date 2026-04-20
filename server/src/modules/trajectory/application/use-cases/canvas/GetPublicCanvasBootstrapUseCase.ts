import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { PublicCanvasAccessMode } from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
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
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(
        input: GetPublicCanvasBootstrapInputDTO
    ): Promise<Result<GetPublicCanvasBootstrapOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );

            let hasTeamMembership = false;
            if (input.userId) {
                const membership = await this.teamMemberRepository.findOne({
                    team: String(trajectory.props.team),
                    user: input.userId
                });
                hasTeamMembership = membership !== null;
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
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
