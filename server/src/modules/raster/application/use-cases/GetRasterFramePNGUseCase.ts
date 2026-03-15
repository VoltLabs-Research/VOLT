import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type {
    GetRasterFramePNGInputDTO,
    GetRasterFramePNGOutputDTO
} from '@modules/raster/application/dtos/GetRasterFramePNGDTO';
import type { IRasterFrameReader } from '@modules/raster/domain/port/IRasterFrameReader';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export class GetRasterFramePNGUseCase implements IUseCase<GetRasterFramePNGInputDTO, GetRasterFramePNGOutputDTO, ApplicationError> {
    constructor(
        @inject(RASTER_TOKENS.RasterFrameReader) private readonly rasterFrameReader: IRasterFrameReader
    ) {}

    async execute(input: GetRasterFramePNGInputDTO): Promise<Result<GetRasterFramePNGOutputDTO, ApplicationError>> {
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
