import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import {
    getClusterGlbStream,
    getLocalGlbStream
} from '@modules/trajectory/utilities/storage/glb-stream-resolution';
import { buildTrajectoryGlbObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';

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
            const requestContext = { acceptEncoding: input.acceptEncoding };

            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            if (!trajectory) {
                return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
            }

            const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            const objectName = buildTrajectoryGlbObjectName(trajectoryId, timestep);

            if (storageClusterId) {
                return Result.ok(await getClusterGlbStream(this.objectGatewayClient, storageClusterId, objectName, requestContext));
            }

            return Result.ok(await getLocalGlbStream(this.storageService, objectName, requestContext));
        } catch {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404));
        }
    }
};
