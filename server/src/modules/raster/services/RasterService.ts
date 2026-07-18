import { ErrorCodes } from '@core/constants/error-codes';
import { RasterFrameService } from '@modules/raster/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/services/RasterJobEnqueuerService';
import { RasterMetadataService } from '@modules/raster/services/RasterMetadataService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { container as diContainer } from 'tsyringe';

interface TriggerRasterizationInput {
    trajectoryId: string;
    teamId: string;
}

interface TriggerRasterizationResult {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}

interface GetRasterFramePNGInput {
    trajectoryId: string;
    teamId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
}

/**
 * The single application service for the raster module (pollium style): folds
 * the former `TriggerRasterizationUseCase`, `GetRasterMetadataUseCase` and
 * `GetRasterFramePNGUseCase` logic verbatim onto the thrown-`ApplicationError`
 * channel. Its three collaborators are genuinely-shared stateful singletons
 * (daemon client / object gateway / cross-module trajectory+analysis repos)
 * resolved once from the DI container by class token:
 *  - frameReader: `RasterFrameService`
 *  - enqueuer: `RasterJobEnqueuerService`
 *  - metadata: `RasterMetadataService`
 * The cross-module `RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase` port is
 * served by a thin adapter (`GetRasterMetadataService`) that delegates to
 * `getRasterMetadata` here.
 */
export default class RasterService {
    #frameReader = diContainer.resolve(RasterFrameService);
    #enqueuer = diContainer.resolve(RasterJobEnqueuerService);
    #metadata = diContainer.resolve(RasterMetadataService);

    async triggerRasterization(input: TriggerRasterizationInput): Promise<TriggerRasterizationResult> {
        try {
            const result = await this.#enqueuer.triggerRasterization(input.trajectoryId, input.teamId);

            if (result.queuedJobs === 0 && result.skippedJobs === 0) {
                throw ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'No rasterizable trajectory models were found in the team cluster storage'
                );
            }

            if (result.queuedJobs === 0 && result.duplicateJobs > 0) {
                throw new ApplicationError(
                    ErrorCodes.RASTER_ALREADY_QUEUED,
                    'Equivalent rasterization jobs are already queued or running for this trajectory',
                    409
                );
            }

            return {
                trajectoryId: input.trajectoryId,
                triggered: result.queuedJobs > 0,
                queuedJobs: result.queuedJobs,
                duplicateJobs: result.duplicateJobs,
                skippedJobs: result.skippedJobs,
                alreadyRasterizedJobs: result.alreadyRasterizedJobs
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to trigger rasterization',
                500
            );
        }
    }

    async getRasterMetadata(input: GetRasterMetadataInputDTO): Promise<GetRasterMetadataOutputDTO> {
        try {
            const metadata = await this.#metadata.getRasterMetadata(input.trajectoryId, input.teamId);

            return { metadata };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster metadata',
                500
            );
        }
    }

    async getRasterFramePNG(input: GetRasterFramePNGInput): Promise<DownloadStreamOutputDTO> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                );
            }

            const rasterFrame = input.analysisId && input.model
                ? await this.#frameReader.getAnalysisRasterFramePNG(
                    input.trajectoryId,
                    input.teamId,
                    input.analysisId,
                    input.timestep,
                    input.model
                )
                : await this.#frameReader.getRasterFramePNG(
                    input.trajectoryId,
                    input.teamId,
                    input.timestep
                );

            return createDownloadStreamResponse({
                stream: rasterFrame.stream,
                contentType: rasterFrame.contentType,
                contentLength: rasterFrame.contentLength,
                cacheControl: rasterFrame.cacheControl,
                filename: rasterFrame.filename,
                disposition: 'inline'
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            );
        }
    }
}
