import type { ITrajectoryFrameRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryFrameRepository';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { PublicCanvasAccessMode } from '@modules/trajectory/dtos/canvas/GetPublicCanvasBootstrapDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type {
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    PublicCanvasBootstrapTrajectoryDTO
} from '@modules/trajectory/dtos/canvas/GetPublicCanvasBootstrapDTO';
import type Trajectory from '@modules/trajectory/entities/trajectory/Trajectory';
import type { TrajectoryFrame } from '@modules/trajectory/entities/trajectory/Trajectory';
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
            simulationCell: (typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id) ?? ''
        }))
    };
};

@Singleton()
export class GetPublicCanvasBootstrapUseCase implements IUseCase<
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,

        
        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository) private readonly trajectoryFrameRepository: ITrajectoryFrameRepository
    ) {}

    async execute(
        input: GetPublicCanvasBootstrapInputDTO
    ): Promise<GetPublicCanvasBootstrapOutputDTO> {
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

        return {
            access: {
                mode: PublicCanvasAccessMode.ReadOnly,
                isGuest: !input.userId,
                isPublic: trajectory.props.isPublic,
                hasTeamMembership
            },
            trajectory: toBootstrapTrajectory(trajectory, frames)
        };
    }
};
