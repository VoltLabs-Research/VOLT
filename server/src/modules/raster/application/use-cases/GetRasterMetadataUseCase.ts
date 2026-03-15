import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@modules/raster/application/dtos/GetRasterMetadataDTO';
import type { IRasterMetadataReader } from '@modules/raster/domain/port/IRasterMetadataReader';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export class GetRasterMetadataUseCase implements IUseCase<GetRasterMetadataInputDTO, GetRasterMetadataOutputDTO, ApplicationError> {
    constructor(
        @inject(RASTER_TOKENS.RasterMetadataReader) private readonly rasterMetadataReader: IRasterMetadataReader
    ) {}

    async execute(input: GetRasterMetadataInputDTO): Promise<Result<GetRasterMetadataOutputDTO, ApplicationError>> {
        try {
            const metadata = await this.rasterMetadataReader.getRasterMetadata(input.trajectoryId, input.teamId);

            return Result.ok({ metadata });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster metadata',
                500
            ));
        }
    }
};
