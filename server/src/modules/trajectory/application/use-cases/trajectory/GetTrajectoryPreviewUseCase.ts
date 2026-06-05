import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import { readTrajectoryPreview } from '@modules/trajectory/utilities/trajectory/read-trajectory-preview';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';

const DASHBOARD_PREVIEW_MAX_WIDTH = 960;
const DASHBOARD_PREVIEW_MAX_HEIGHT = 540;

@injectable()
export default class GetTrajectoryPreviewUseCase implements IUseCase<GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO, ApplicationError> {
    constructor(
        
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ){}

    async execute(input: GetTrajectoryPreviewInputDTO): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            return Result.fail(ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            ));
        }

        const preview = await readTrajectoryPreview({
            trajectoryId,
            storageClusterId,
            objectGatewayClient: this.objectGatewayClient,
            createOutput: this.createPreviewOutput.bind(this)
        });
        if (preview) {
            return Result.ok(preview);
        }

        return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404));
    }

    // Why: rasters are generated at 4K for the canvas workspace; the dashboard
    // card thumbnail only renders at ~200px tall, so downscale before base64
    // to keep payloads and browser decode cost small.
    private async createPreviewOutput(buffer: Buffer): Promise<GetTrajectoryPreviewOutputDTO> {
        const resized = await sharp(buffer)
            .resize(DASHBOARD_PREVIEW_MAX_WIDTH, DASHBOARD_PREVIEW_MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .png({ compressionLevel: 9 })
            .toBuffer();

        const etag = `"${createHash('sha256').update(resized).digest('hex')}"`;

        return {
            base64: `data:image/png;base64,${resized.toString('base64')}`,
            etag
        };
    }
};
