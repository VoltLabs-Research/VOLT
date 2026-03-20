import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Result } from '@shared/domain/port/Result';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryDTO';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class DownloadTrajectoryUseCase implements IUseCase<DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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

        if (trajectory.props.teamCluster) {
            const firstFrame = [...trajectory.props.frames].sort((left, right) => left.timestep - right.timestep)[0];
            if (!firstFrame) {
                return Result.fail(ApplicationError.notFound(
                    'Trajectory::Dump::NotFound',
                    'No dump data available for this trajectory'
                ));
            }

            const objectName = this.dumpStorage.getObjectName(trajectoryId, String(firstFrame.timestep));
            const stream = await this.teamClusterDaemonClient.commandStream(trajectory.props.teamCluster, TEAM_CLUSTER_DAEMON_COMMAND.object.get, {
                bucket: 'volt-dumps',
                objectKey: objectName
            });
            const filename = input.name
                ? `${input.name}.dump.gz`
                : `${trajectory.props.name}.dump.gz`;

            return Result.ok({ stream, filename });
        }

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
};
