import { injectable, inject } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { ErrorCodes } from '@core/constants/error-codes';
import type {
    DownloadTrajectoryInputDTO,
    DownloadTrajectoryOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryDTO';

@injectable()
export default class DownloadTrajectoryUseCase implements IUseCase<DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService
    ) {}

    async execute(input: DownloadTrajectoryInputDTO): Promise<Result<DownloadTrajectoryOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;

        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        // TODO: Currently downloads the first available timestep dump.
        // A more complete implementation could bundle all timesteps into a zip archive
        // or allow the client to specify which timestep to download.
        const timesteps = await this.dumpStorage.listDumps(trajectoryId);
        if (timesteps.length === 0) {
            return Result.fail(ApplicationError.notFound(
                'Trajectory::Dump::NotFound',
                'No dump data available for this trajectory'
            ));
        }

        const firstTimestep = timesteps[0];
        const stream = await this.dumpStorage.getDumpStream(trajectoryId, firstTimestep);
        const filename = input.name
            ? `${input.name}.dump`
            : `${trajectory.props.name}.dump`;

        return Result.ok({ stream, filename });
    }
}
