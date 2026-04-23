import { ErrorCodes } from '@core/constants/error-codes';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { GetRasterFramePNGInputDTO } from '@modules/raster/application/dtos/GetRasterFramePNGDTO';
import { RasterFrameService } from '@modules/raster/infrastructure/services/RasterFrameService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { injectable } from 'tsyringe';

@injectable()
export class GetRasterFramePNGUseCase implements IUseCase<GetRasterFramePNGInputDTO, DownloadStreamOutputDTO, ApplicationError> {
    constructor(
        private readonly rasterFrameReader: RasterFrameService
    ) {}

    async execute(input: GetRasterFramePNGInputDTO): Promise<Result<DownloadStreamOutputDTO, ApplicationError>> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                ));
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

            return Result.ok(createDownloadStreamResponse({
                stream: rasterFrame.stream,
                contentType: rasterFrame.contentType,
                contentLength: rasterFrame.contentLength,
                cacheControl: rasterFrame.cacheControl,
                filename: rasterFrame.filename,
                disposition: 'inline'
            }));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            ));
        }
    }
};
