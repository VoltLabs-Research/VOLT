import { ErrorCodes } from '@core/constants/error-codes';
import { SYS_BUCKETS } from '@core/config/minio';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Result } from '@shared/domain/port/Result';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import {
    createDownloadStreamResponse,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryDTO';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class DownloadTrajectoryUseCase implements IUseCase<DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: DownloadTrajectoryInputDTO): Promise<Result<DownloadTrajectoryOutputDTO, ApplicationError>> {
        const { trajectoryId, archive } = input;

        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const timesteps = await this.dumpStorage.listDumps(trajectoryId);
        if (timesteps.length === 0) {
            return Result.fail(ApplicationError.notFound(
                'Trajectory::Dump::NotFound',
                'No dump data available for this trajectory'
            ));
        }

        if (archive) {
            return Result.ok(this.createArchiveDownloadResponse(input, trajectory.props.name, trajectory.props.teamCluster, timesteps));
        }

        const firstTimestep = timesteps[0];
        const filenameBase = sanitizeDownloadName(input.name || trajectory.props.name || trajectoryId, 'trajectory');

        if (trajectory.props.teamCluster) {
            const objectName = this.dumpStorage.getObjectName(trajectoryId, firstTimestep);
            const stream = await this.teamClusterDaemonClient.commandStream(
                trajectory.props.teamCluster,
                TEAM_CLUSTER_DAEMON_COMMAND.object.get,
                {
                    bucket: SYS_BUCKETS.DUMPS,
                    objectKey: objectName
                }
            );

            return Result.ok(createDownloadStreamResponse({
                stream,
                contentType: 'application/gzip',
                filename: `${filenameBase}.dump.gz`,
                cacheControl: 'no-cache'
            }));
        }

        const stream = await this.dumpStorage.getDumpStream(trajectoryId, firstTimestep);
        return Result.ok(createDownloadStreamResponse({
            stream,
            contentType: 'application/octet-stream',
            filename: `${filenameBase}.dump`,
            cacheControl: 'no-cache'
        }));
    }

    private createArchiveDownloadResponse(
        input: DownloadTrajectoryInputDTO,
        trajectoryName: string | undefined,
        teamClusterId: string | undefined,
        timesteps: string[]
    ): DownloadTrajectoryOutputDTO {
        const filenameBase = sanitizeDownloadName(input.name || trajectoryName || input.trajectoryId, 'trajectory');

        return createZipDownloadResponse({
            filename: `${filenameBase}-dumps`,
            cacheControl: 'no-cache',
            appendEntries: async (archive) => {
                for (const timestep of timesteps) {
                    const objectName = this.dumpStorage.getObjectName(input.trajectoryId, timestep);
                    const stream = teamClusterId
                        ? await this.teamClusterDaemonClient.commandStream(
                            teamClusterId,
                            TEAM_CLUSTER_DAEMON_COMMAND.object.get,
                            {
                                bucket: SYS_BUCKETS.DUMPS,
                                objectKey: objectName
                            }
                        )
                        : await this.storageService.getStream(SYS_BUCKETS.DUMPS, objectName);

                    archive.append(stream, {
                        name: objectName
                    });
                }
            }
        });
    }
};
