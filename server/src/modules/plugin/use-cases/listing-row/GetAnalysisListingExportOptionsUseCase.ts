import { GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO } from '@modules/plugin/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';

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
    ): Promise<GetAnalysisListingExportOptionsOutputDTO> {
        return await this.analysisListingExportCatalogService.getExportOptions(input.analysisId);
    }
}
