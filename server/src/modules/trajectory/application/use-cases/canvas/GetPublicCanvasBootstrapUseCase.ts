import { PublicCanvasAccessMode } from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import type {
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    PublicCanvasBootstrapTrajectoryDTO
} from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import type { IUseCase } from '@shared/application/IUseCase';

const toBootstrapTrajectory = (trajectory: Trajectory, frames: TrajectoryFrame[]): PublicCanvasBootstrapTrajectoryDTO => {
    return {
        _id: trajectory.id,
        name: trajectory.props.name,
        status: trajectory.props.status,
        isPublic: trajectory.props.isPublic,
        teamId: String(trajectory.props.team),
        analysisIds: trajectory.props.analysis ?? [],
        frames: frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: String(frame.simulationCell)
        }))
    };
};

@Singleton()
export class GetPublicCanvasBootstrapUseCase implements IUseCase<
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly teamMemberRepository: TeamMemberRepository,

        
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository
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

            const frames = await this.trajectoryFrameRepository.getFrames(trajectory.id);

            return Result.ok({
                access: {
                    mode: PublicCanvasAccessMode.ReadOnly,
                    isGuest: !input.userId,
                    isPublic: trajectory.props.isPublic,
                    hasTeamMembership
                },
                trajectory: toBootstrapTrajectory(trajectory, frames)
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
