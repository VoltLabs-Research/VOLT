import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { GetSimulationCellByTrajectoryOutputDTO } from '@shared/contracts/dtos';
import type { IGetSimulationCellByTrajectoryUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
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
    GetSimulationCellByTrajectoryOutputDTO,
    ApplicationError
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase)
        private readonly getSimulationCellByTrajectoryUseCase: IGetSimulationCellByTrajectoryUseCase
    ) {}

    async execute(input: GetPublicCanvasSimulationCellInput): Promise<Result<GetSimulationCellByTrajectoryOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            return this.getSimulationCellByTrajectoryUseCase.execute({
                teamId: String(trajectory.props.team),
                trajectoryId: input.trajectoryId,
                timestep: input.timestep
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
