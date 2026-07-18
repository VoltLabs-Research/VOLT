import { ExportListingRowsByAnalysisIdInputDTO } from '@modules/plugin/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';

import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';
import { ListingRowsExportPresenter } from '@modules/plugin/presenters/listing-row/ListingRowsExportPresenter';

@Singleton()
export class ExportListingRowsByAnalysisIdUseCase implements IUseCase<
    ExportListingRowsByAnalysisIdInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        private readonly listingRowsExportPresenter: ListingRowsExportPresenter,
        private readonly analysisListingExportCatalogService: AnalysisListingExportCatalogService
    ) {}

    async execute(input: ExportListingRowsByAnalysisIdInputDTO): Promise<DownloadStreamOutputDTO> {
        const payload = await this.analysisListingExportCatalogService.buildExportPayload(input);

        return await this.listingRowsExportPresenter.present(payload);
    }
}
