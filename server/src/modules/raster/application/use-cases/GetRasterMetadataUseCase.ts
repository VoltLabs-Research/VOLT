import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@modules/raster/application/dtos/GetRasterMetadataDTO';
import type { IRasterMetadataService } from '@modules/raster/domain/port/IRasterMetadataService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports/IGetRasterMetadataUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { inject, injectable } from 'tsyringe';

// `@injectable()` preserves the existing by-class resolution (the raster
// controller resolves this use case by its class constructor — unchanged
// transient lifecycle). `@AliasOf(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)`
// additively exposes the neutral `Symbol.for('GetRasterMetadataUseCase')` token
// (delegating to the same class) so the trajectory module can
// `@inject(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)` against the
// IGetRasterMetadataUseCase port without importing `@modules/raster`. A bare
// `@injectable(token)` does not exist; using the Singleton+AliasOf pair would
// change the lifecycle, so AliasOf-over-injectable is the minimal idiom here.
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
