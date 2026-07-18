import { ErrorCodes } from '@core/constants/error-codes';
import type { GetRasterFramePNGInputDTO } from '@modules/raster/application/dtos/GetRasterFramePNGDTO';
import type {
    TriggerRasterizationInputDTO,
    TriggerRasterizationOutputDTO
} from '@modules/raster/application/dtos/TriggerRasterizationDTO';
import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';
import { TriggerRasterizationUseCase } from '@modules/raster/application/use-cases/TriggerRasterizationUseCase';
import type { IRasterFrameReader } from '@modules/raster/domain/port/IRasterFrameReader';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { inject } from 'tsyringe';

/**
 * The single application service for the raster module. `getRasterFramePNG`
 * folds the exact logic of the former `GetRasterFramePNGUseCase`, converting the
 * Result error channel to thrown `ApplicationError`s so Express 5 forwards them
 * to the global error middleware. `triggerRasterization` and `getRasterMetadata`
 * delegate to their retained use cases: `TriggerRasterizationUseCase` is still
 * consumed by the render-screenshot AI tool, and `GetRasterMetadataUseCase`
 * implements the cross-module `IGetRasterMetadataUseCase` port
 * (`RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase`). Both are unwrapped here
 * onto the thrown-error channel used by the folded method.
 */
@Singleton(RASTER_TOKENS.RasterService)
export default class RasterService {
    constructor(
        @inject(RASTER_TOKENS.RasterFrameReader) private readonly rasterFrameReader: IRasterFrameReader,
        @inject(TriggerRasterizationUseCase) private readonly triggerRasterizationUseCase: TriggerRasterizationUseCase,
        @inject(GetRasterMetadataUseCase) private readonly getRasterMetadataUseCase: GetRasterMetadataUseCase
    ) {}

    async triggerRasterization(input: TriggerRasterizationInputDTO): Promise<TriggerRasterizationOutputDTO> {
        return this.triggerRasterizationUseCase.execute(input);
    }

    async getRasterMetadata(input: GetRasterMetadataInputDTO): Promise<GetRasterMetadataOutputDTO> {
        return this.getRasterMetadataUseCase.execute(input);
    }

    async getRasterFramePNG(input: GetRasterFramePNGInputDTO): Promise<DownloadStreamOutputDTO> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                );
            }

            const rasterFrame = input.analysisId && input.model
                ? await this.rasterFrameReader.getAnalysisRasterFramePNG(
                    input.trajectoryId,
                    input.teamId,
                    input.analysisId,
                    input.timestep,
                    input.model
                )
                : await this.rasterFrameReader.getRasterFramePNG(
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
