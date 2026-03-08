import {
    createSerializedDownloadResponse,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@modules/plugin/utilities/plugin/create-download-response';
import { toCsvContent } from '@modules/plugin/utilities/listing-row/csv';

import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Readable } from 'node:stream';
import { injectable } from 'tsyringe';

import type {
    AnalysisListingExportData,
    AnalysisSubListingExportData,
    ExportListingRowsByAnalysisIdOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { IListingRowsExportPresenter } from '@modules/plugin/domain/port/listing-row/IListingRowsExportPresenter';

@injectable()
export class ListingRowsExportPresenter implements IListingRowsExportPresenter {
    private getEmptyListing(analysisId: string): AnalysisListingExportData {
        return {
            listingId: 'listing',
            listingName: 'listing',
            rows: [],
            columns: ['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep']
        };
    }

    private appendListingCsv(
        archive: Parameters<NonNullable<Parameters<typeof createZipDownloadResponse>[0]['appendEntries']>>[0],
        analysisId: string,
        listing: AnalysisListingExportData
    ): void {
        const csvName = `${analysisId}_${sanitizeDownloadName(listing.listingName, 'listing')}_listing.csv`;
        const csvContent = toCsvContent(listing.rows, listing.columns);

        archive.append(Readable.from([csvContent]), {
            name: csvName
        });
    }

    private appendSubListingCsv(
        archive: Parameters<NonNullable<Parameters<typeof createZipDownloadResponse>[0]['appendEntries']>>[0],
        analysisId: string,
        subListing: AnalysisSubListingExportData
    ): void {
        const exposureName = sanitizeDownloadName(subListing.exposureName, subListing.exposureId || 'exposure');
        const subListingName = sanitizeDownloadName(subListing.subListingName, 'sub-listing');
        const csvName = `${analysisId}_${exposureName}_${subListingName}_timestep-${subListing.timestep}_sub-listing.csv`;
        const csvContent = toCsvContent(subListing.rows, subListing.columns);

        archive.append(Readable.from([csvContent]), {
            name: csvName
        });
    }

    present(payload: ExportListingRowsByAnalysisIdOutputDTO): DownloadStreamOutputDTO {
        if (payload.listings.length <= 1 && payload.subListings.length === 0) {
            const listing = payload.listings[0] || this.getEmptyListing(payload.analysisId);

            return createSerializedDownloadResponse({
                filename: `${payload.analysisId}_${sanitizeDownloadName(listing.listingName, 'listing')}_listing`,
                format: ExportType.Csv,
                rows: listing.rows,
                columns: listing.columns
            });
        }

        return createZipDownloadResponse({
            filename: `${payload.analysisId}_analysis_listings`,
            appendEntries: async (archive) => {
                for (const listing of payload.listings) {
                    this.appendListingCsv(archive, payload.analysisId, listing);
                }

                for (const subListing of payload.subListings) {
                    this.appendSubListingCsv(archive, payload.analysisId, subListing);
                }
            }
        });
    }
};
