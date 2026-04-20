import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import {
    GetPublicCanvasGLBInputDTO,
    GetPublicCanvasGLBOutputDTO
} from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasGLBDTO';
import { buildTrajectoryGlbObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import {
    getClusterGlbStream,
    getLocalGlbStream
} from '@modules/trajectory/utilities/storage/glb-stream-resolution';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export class GetPublicCanvasGLBUseCase implements IUseCase<
    GetPublicCanvasGLBInputDTO,
    GetPublicCanvasGLBOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
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

            if (storageClusterId) {
                return Result.ok(await getClusterGlbStream(this.objectGatewayClient, storageClusterId, objectName));
            }

            return Result.ok(await getLocalGlbStream(this.storageService, objectName));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404));
        }
    }
};
