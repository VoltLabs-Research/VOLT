import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type { IClusterObjectArchiveService } from '@modules/cluster/domain/port/IClusterObjectArchiveService';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryDTO';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    createDownloadStreamResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { injectable } from 'tsyringe';
import { v4 } from 'uuid';

@injectable()
export default class DownloadTrajectoryUseCase implements IUseCase<DownloadTrajectoryInputDTO, DownloadTrajectoryOutputDTO, ApplicationError> {
    constructor(

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        @inject(CLUSTER_TOKENS.ClusterObjectArchiveService)
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    async execute(input: DownloadTrajectoryInputDTO): Promise<Result<DownloadTrajectoryOutputDTO, ApplicationError>> {
        const { trajectoryId, archive } = input;

        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory || trajectory.props.team !== input.teamId) {
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
        if (!storageClusterId) {
            return Result.fail(ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            ));
        }
        const filenameBase = sanitizeDownloadName(input.name || trajectory.props.name || trajectoryId, 'trajectory');

        if (archive) {
            return Result.ok(await this.createArchiveDownloadResponse(input, trajectory.props.name, storageClusterId, timesteps));
        }

        const firstTimestep = timesteps[0];
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, firstTimestep);

        const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);
        return Result.ok(createDownloadStreamResponse({
            stream: response.stream,
            contentType: response.contentType || 'application/octet-stream',
            filename: objectName.split('/').pop() || `${filenameBase}.dump.zst`,
            cacheControl: 'no-cache'
        }));
    }

    private async createArchiveDownloadResponse(
        input: DownloadTrajectoryInputDTO,
        trajectoryName: string | undefined,
        teamClusterId: string,
        timesteps: string[]
    ): Promise<DownloadTrajectoryOutputDTO> {
        const filenameBase = sanitizeDownloadName(input.name || trajectoryName || input.trajectoryId, 'trajectory');

        return this.archiveService.createArchiveDownload({
            teamClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-downloads/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-dumps.zip`,
            cacheControl: 'no-cache',
            entries: timesteps.map((timestep) => {
                const objectName = buildTrajectoryDumpObjectName(input.trajectoryId, timestep);
                return {
                    type: 'object' as const,
                    ownerClusterId: teamClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                    objectKey: objectName,
                    name: objectName.split('/').pop() || objectName
                };
            })
        });
    }
}
