import RasterService from '@modules/raster/services/RasterService';
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports/IGetRasterMetadataUseCase';
import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Thin cross-module adapter registered under the neutral
 * `RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase` token so
 * `@modules/trajectory`'s public-canvas raster-metadata use case can resolve
 * "get raster metadata" without importing the owner module. The real logic was
 * folded into {@link RasterService.getRasterMetadata}; this adapter simply `new`s
 * the service and delegates, keeping a single implementation.
 */
@Singleton(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)
export default class GetRasterMetadataService implements IGetRasterMetadataUseCase {
    #service = new RasterService();

    async execute(input: GetRasterMetadataInputDTO): Promise<GetRasterMetadataOutputDTO> {
        return this.#service.getRasterMetadata(input);
    }
}
