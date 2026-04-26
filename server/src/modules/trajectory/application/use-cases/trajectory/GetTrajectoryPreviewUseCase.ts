import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import { readTrajectoryPreview } from '@modules/trajectory/utilities/trajectory/read-trajectory-preview';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { inject, injectable } from 'tsyringe';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

const DASHBOARD_PREVIEW_MAX_WIDTH = 960;
const DASHBOARD_PREVIEW_MAX_HEIGHT = 540;

@injectable()
export default class GetTrajectoryPreviewUseCase implements IUseCase<GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepository: TrajectoryRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ){}

    async execute(input: GetTrajectoryPreviewInputDTO): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);

        const preview = await readTrajectoryPreview({
            trajectoryId,
            storageClusterId,
            storageService: this.storageService,
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
