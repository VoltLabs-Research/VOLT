import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import {
    GetPublicCanvasGLBInputDTO,
    GetPublicCanvasGLBOutputDTO
} from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasGLBDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import {
    getClusterGlbStream,
    getLocalGlbStream
} from '@modules/trajectory/utilities/storage/glb-stream-resolution';
import { buildTrajectoryGlbObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@Singleton()
export class GetPublicCanvasGLBUseCase implements IUseCase<
    GetPublicCanvasGLBInputDTO,
    GetPublicCanvasGLBOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(
        input: GetPublicCanvasGLBInputDTO
    ): Promise<Result<GetPublicCanvasGLBOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );
            const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            const objectName = buildTrajectoryGlbObjectName(input.trajectoryId, input.timestep);
            const requestContext = { acceptEncoding: input.acceptEncoding };

            if (storageClusterId) {
                return Result.ok(await getClusterGlbStream(this.objectGatewayClient, storageClusterId, objectName, requestContext));
            }

            return Result.ok(await getLocalGlbStream(this.storageService, objectName, requestContext));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404));
        }
    }
};
