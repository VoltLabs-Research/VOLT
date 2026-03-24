import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export default class GetTrajectoryGLBUseCase implements IUseCase<GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ){}

    async execute(input: GetTrajectoryGLBInputDTO): Promise<Result<GetTrajectoryGLBOutputDTO, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;

            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            if (!trajectory) {
                return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
            }

            const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);

            if (storageClusterId) {
                const response = await this.objectGatewayClient.getStream(
                    storageClusterId,
                    SYS_BUCKETS.MODELS,
                    objectName
                );

                return Result.ok({
                    stream: response.stream,
                    size: response.contentLength,
                    objectName
                });
            }

            const [stat, stream] = await Promise.all([
                this.storageService.getStat(SYS_BUCKETS.MODELS, objectName),
                this.storageService.getStream(SYS_BUCKETS.MODELS, objectName)
            ]);

            return Result.ok({ stream, size: stat.size, objectName });
        } catch {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404));
        }
    }
};
