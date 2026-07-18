import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { GetSimulationCellByTrajectoryOutputDTO } from '@shared/contracts/dtos';
import type { IGetSimulationCellByTrajectoryUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasSimulationCellInput {
    trajectoryId: string;
    timestep?: number;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasSimulationCellUseCase implements IUseCase<
    GetPublicCanvasSimulationCellInput,
    GetSimulationCellByTrajectoryOutputDTO
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase)
        private readonly getSimulationCellByTrajectoryUseCase: IGetSimulationCellByTrajectoryUseCase
    ) {}

    async execute(input: GetPublicCanvasSimulationCellInput): Promise<GetSimulationCellByTrajectoryOutputDTO> {
        const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        return this.getSimulationCellByTrajectoryUseCase.execute({
            teamId: String(trajectory.props.team),
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
    }
};
