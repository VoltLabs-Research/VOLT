import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryDTO';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import {
    createDownloadStreamResponse,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DownloadTrajectoryUseCase implements IUseCase<DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepo: TrajectoryRepository,

        
        private readonly dumpStorage: TrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
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
