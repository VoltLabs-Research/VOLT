import { ErrorCodes } from '@core/constants/error-codes';
import { SYS_BUCKETS } from '@core/config/minio';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { Result } from '@shared/domain/port/Result';
import {
    createDownloadStreamResponse,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
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

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);

        if (archive) {
            return Result.ok(this.createArchiveDownloadResponse(input, trajectory.props.name, storageClusterId, timesteps));
        }

        const firstTimestep = timesteps[0];
        const filenameBase = sanitizeDownloadName(input.name || trajectory.props.name || trajectoryId, 'trajectory');

        if (storageClusterId) {
            const objectName = buildTrajectoryDumpObjectName(trajectoryId, firstTimestep);
            const response = await this.objectGatewayClient.getStream(storageClusterId, SYS_BUCKETS.DUMPS, objectName);

            return Result.ok(createDownloadStreamResponse({
                stream: response.stream,
                contentType: response.contentType || 'application/octet-stream',
                filename: objectName.split('/').pop() || `${filenameBase}.dump.zst`,
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
                    const objectName = buildTrajectoryDumpObjectName(input.trajectoryId, timestep);
                    const stream = teamClusterId
                        ? (await this.objectGatewayClient.getStream(teamClusterId, SYS_BUCKETS.DUMPS, objectName)).stream
                        : await this.storageService.getStream(SYS_BUCKETS.DUMPS, objectName);

                    archive.append(stream, {
                        name: objectName
                    });
                }
            }
        });
    }
}
