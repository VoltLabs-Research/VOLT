import { toCsvContent } from '@modules/plugin/utilities/listing-row/csv';
import { Singleton } from '@shared/infrastructure/di/decorators';
import {
    createSerializedDownloadResponse,
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';

import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Readable } from 'node:stream';


import type {
    AnalysisListingExportData,
    AnalysisSubListingExportData,
    ExportListingRowsByAnalysisIdOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

/**
 * Converts a snake_case or hyphen-separated name to Title-Case with hyphens.
 *
 * @example titleCaseName('dislocation_segments') // 'Dislocation-Segments'
 * @example titleCaseName('facets') // 'Facets'
 * @example titleCaseName('grain-points') // 'Grain-Points'
 */
const titleCaseName = (name: string): string => {
    return name
        .split(/[_-]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('-');
};

@Singleton()
export class ListingRowsExportPresenter {
    private rootDir(analysisId: string): string {
        return `AnalysisID-${analysisId}`;
    }

    private getEmptyListing(analysisId: string): AnalysisListingExportData {
        return {
            listingId: 'listing',
            listingName: 'listing',
            rows: [],
            columns: ['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep']
        };
    }

    private appendConfigCsv(
        archive: Parameters<NonNullable<Parameters<typeof createZipDownloadResponse>[0]['appendEntries']>>[0],
        analysisId: string,
        config: Record<string, unknown>
    ): void {
        const rows = Object.entries(config).map(([key, value]) => ({
            Key: key,
            Value: String(value)
        }));
        const csvContent = toCsvContent(rows, ['Key', 'Value']);

        archive.append(Readable.from([csvContent]), {
            name: `${this.rootDir(analysisId)}/Config.csv`
        });
    }

    private appendListingCsv(
        archive: Parameters<NonNullable<Parameters<typeof createZipDownloadResponse>[0]['appendEntries']>>[0],
        analysisId: string,
        listing: AnalysisListingExportData
    ): void {
        const listingName = sanitizeDownloadName(listing.listingName, 'listing');
        const csvName = `${this.rootDir(analysisId)}/${listingName}.csv`;
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
        const subListingName = titleCaseName(sanitizeDownloadName(subListing.subListingName, 'sub-listing'));
        const csvName = `${this.rootDir(analysisId)}/TS-${subListing.timestep}/${exposureName}/${subListingName}.csv`;
        const csvContent = toCsvContent(subListing.rows, subListing.columns);

        archive.append(Readable.from([csvContent]), {
            name: csvName
        });
    }

    private hasConfig(config: Record<string, unknown> | undefined): config is Record<string, unknown> {
        return config !== undefined && Object.keys(config).length > 0;
    }

    present(payload: ExportListingRowsByAnalysisIdOutputDTO): DownloadStreamOutputDTO {
        const hasConfig = this.hasConfig(payload.config);

        if (payload.listings.length <= 1 && payload.subListings.length === 0 && !hasConfig) {
            const listing = payload.listings[0] || this.getEmptyListing(payload.analysisId);
            const listingName = sanitizeDownloadName(listing.listingName, 'listing');

            return createSerializedDownloadResponse({
                filename: `AnalysisID-${payload.analysisId}_${listingName}`,
                format: ExportType.Csv,
                rows: listing.rows,
                columns: listing.columns
            });
        }

        return createZipDownloadResponse({
            filename: `AnalysisID-${payload.analysisId}`,
            appendEntries: async (archive) => {
                if (hasConfig) {
                    this.appendConfigCsv(archive, payload.analysisId, payload.config!);
                }

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
