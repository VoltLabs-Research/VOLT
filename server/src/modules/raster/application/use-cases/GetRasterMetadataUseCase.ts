import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { IRasterMetadataService } from '@modules/raster/domain/port/IRasterMetadataService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports/IGetRasterMetadataUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { inject, injectable } from 'tsyringe';

@injectable()
@AliasOf(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)
export class GetRasterMetadataUseCase implements
    IUseCase<GetRasterMetadataInputDTO, GetRasterMetadataOutputDTO, ApplicationError>,
    IGetRasterMetadataUseCase {
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
