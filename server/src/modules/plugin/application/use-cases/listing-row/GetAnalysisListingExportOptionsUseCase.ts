import { GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import { AnalysisListingExportCatalogService } from '@modules/plugin/application/services/listing-row/AnalysisListingExportCatalogService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class GetAnalysisListingExportOptionsUseCase implements IUseCase<
    GetAnalysisListingExportOptionsInputDTO,
    GetAnalysisListingExportOptionsOutputDTO
> {
    constructor(
        private readonly analysisListingExportCatalogService: AnalysisListingExportCatalogService
    ) {}

    async execute(
        input: GetAnalysisListingExportOptionsInputDTO
    ): Promise<Result<GetAnalysisListingExportOptionsOutputDTO>> {
        return Result.ok(await this.analysisListingExportCatalogService.getExportOptions(input.analysisId));
    }
}
