import { ExportListingRowsByAnalysisIdInputDTO } from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { AnalysisListingExportCatalogService } from '@modules/plugin/application/services/listing-row/AnalysisListingExportCatalogService';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { IListingRowsExportPresenter } from '@modules/plugin/domain/port/listing-row/IListingRowsExportPresenter';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class ExportListingRowsByAnalysisIdUseCase implements IUseCase<
    ExportListingRowsByAnalysisIdInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowsExportPresenter)
        private readonly listingRowsExportPresenter: IListingRowsExportPresenter,
        @inject(AnalysisListingExportCatalogService)
        private readonly analysisListingExportCatalogService: AnalysisListingExportCatalogService
    ) {}

    async execute(input: ExportListingRowsByAnalysisIdInputDTO): Promise<Result<DownloadStreamOutputDTO>> {
        const payload = await this.analysisListingExportCatalogService.buildExportPayload(input);

        return Result.ok(this.listingRowsExportPresenter.present(payload));
    }
}
