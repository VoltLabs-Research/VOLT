import type { ExportListingRowsByAnalysisIdOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

export interface IListingRowsExportPresenter {
    present(payload: ExportListingRowsByAnalysisIdOutputDTO): DownloadStreamOutputDTO;
}
