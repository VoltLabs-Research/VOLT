import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { GetSimulationCellByTrajectoryOutputDTO } from '@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasSimulationCellInput {
    trajectoryId: string;
    timestep?: number;
    userId?: string;
};

@injectable()
export class GetPublicCanvasSimulationCellUseCase implements IUseCase<
    GetPublicCanvasSimulationCellInput,
    GetSimulationCellByTrajectoryOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetSimulationCellByTrajectoryUseCase)
        private readonly getSimulationCellByTrajectoryUseCase: GetSimulationCellByTrajectoryUseCase
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
