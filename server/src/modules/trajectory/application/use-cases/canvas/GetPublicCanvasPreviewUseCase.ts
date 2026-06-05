import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createHash } from 'node:crypto';

import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { readTrajectoryPreview } from '@modules/trajectory/utilities/trajectory/read-trajectory-preview';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasPreviewInput {
    trajectoryId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasPreviewUseCase implements IUseCase<
    GetPublicCanvasPreviewInput,
    GetTrajectoryPreviewOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,
        
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: GetPublicCanvasPreviewInput): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );

            const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            if (!storageClusterId) {
                return Result.fail(ApplicationError.conflict(
                    'Trajectory::StorageClusterRequired',
                    'Trajectory storage cluster is required'
                ));
            }

            const preview = await readTrajectoryPreview({
                trajectoryId: input.trajectoryId,
                storageClusterId,
                objectGatewayClient: this.objectGatewayClient,
                createOutput: this.createPreviewOutput.bind(this)
            });
            if (preview) {
                return Result.ok(preview);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'No preview available for this trajectory',
                404
            ));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }

    private createPreviewOutput(buffer: Buffer): GetTrajectoryPreviewOutputDTO {
        const etag = `"${createHash('sha256').update(buffer).digest('hex')}"`;

        return {
            base64: `data:image/png;base64,${buffer.toString('base64')}`,
            etag
        };
    }
};
