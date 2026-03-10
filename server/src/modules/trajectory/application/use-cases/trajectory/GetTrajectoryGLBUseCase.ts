import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
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

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: GetTrajectoryGLBInputDTO): Promise<Result<GetTrajectoryGLBOutputDTO, ApplicationError>> {
        try {
            const { trajectoryId, timestep } = input;
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;

            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            if (!trajectory) {
                return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
            }

            if (trajectory.props.teamCluster) {
                const stream = await this.teamClusterDaemonClient.commandStream(trajectory.props.teamCluster, 'object.get', {
                    bucket: 'volt-models',
                    objectKey: objectName
                });

                return Result.ok({ stream, objectName });
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
