import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@modules/raster/application/dtos/GetRasterMetadataDTO';
import type { IRasterMetadataService } from '@modules/raster/domain/port/IRasterMetadataService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetRasterMetadataUseCase implements IUseCase<GetRasterMetadataInputDTO, GetRasterMetadataOutputDTO, ApplicationError> {
    constructor(
        @inject(RASTER_TOKENS.RasterMetadataService) private readonly rasterMetadataReader: IRasterMetadataService
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
}
