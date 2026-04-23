import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';
import {
    getClusterGlbStream,
    getLocalGlbStream
} from '@modules/trajectory/utilities/storage/glb-stream-resolution';
import { buildTrajectoryGlbObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { inject, injectable } from 'tsyringe';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class GetTrajectoryGLBUseCase implements IUseCase<GetTrajectoryGLBInputDTO, GetTrajectoryGLBOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepository: TrajectoryRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
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
