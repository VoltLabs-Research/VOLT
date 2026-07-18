import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { IRasterMetadataService } from '@modules/raster/ports/IRasterMetadataService';
import { RASTER_TOKENS } from '@modules/raster/di/RasterTokens';
import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports/IGetRasterMetadataUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { inject, injectable } from 'tsyringe';

@injectable()
@AliasOf(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)
export class GetRasterMetadataUseCase implements
    IUseCase<GetRasterMetadataInputDTO, GetRasterMetadataOutputDTO>,
    IGetRasterMetadataUseCase {
    constructor(
        @inject(RASTER_TOKENS.RasterMetadataService) private readonly rasterMetadataReader: IRasterMetadataService
    ) {}

    async execute(input: GetRasterMetadataInputDTO): Promise<GetRasterMetadataOutputDTO> {
        try {
            const metadata = await this.rasterMetadataReader.getRasterMetadata(input.trajectoryId, input.teamId);

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
}
