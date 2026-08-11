import type {
    IClusterObjectArchiveService,
    ClusterArchiveInlineEntry
} from '@shared/contracts/ports/IClusterObjectArchiveService';
import { toCsvContent } from '@shared/infrastructure/http/responses/ExportFileResponse';
import {
    createDownloadStreamResponse,
    createSerializedDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';

import { ExportType } from '@shared/domain/port/persistence';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';

import type {
    AnalysisListingExportData,
    AnalysisSubListingExportData,
    ExportListingRowsByAnalysisIdOutput
} from '@modules/plugin/services/listing-row/ListingRowTypes';
import { LISTING_COLUMNS } from '@modules/plugin/services/listing-row/ListingTableAggregation';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';

const titleCaseName = (name: string): string => {
    return name
        .split(/[_-]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('-');
};

export class ListingRowsExportService {
    constructor(
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    private rootDir(analysisId: string): string {
        return `AnalysisID-${analysisId}`;
    }

    private getEmptyListing(): AnalysisListingExportData {
        return {
            listingId: 'listing',
            listingName: 'listing',
            rows: [],
            columns: [...LISTING_COLUMNS]
        };
    }

    private createConfigCsvEntry(
        analysisId: string,
        config: Record<string, unknown>
    ): ClusterArchiveInlineEntry {
        const rows = Object.entries(config).map(([key, value]) => ({
            Key: key,
            Value: String(value)
        }));
        const csvContent = toCsvContent(rows, ['Key', 'Value']);

        return {
            type: 'inline',
            name: `${this.rootDir(analysisId)}/Config.csv`,
            content: csvContent
        };
    }

    private createListingCsvEntry(
        analysisId: string,
        listing: AnalysisListingExportData
    ): ClusterArchiveInlineEntry {
        const listingName = sanitizeDownloadName(listing.listingName, 'listing');
        const csvName = `${this.rootDir(analysisId)}/${listingName}.csv`;
        const csvContent = toCsvContent(listing.rows, listing.columns);

        return {
            type: 'inline',
            name: csvName,
            content: csvContent
        };
    }

    private createSubListingCsvEntry(
        analysisId: string,
        subListing: AnalysisSubListingExportData
    ): ClusterArchiveInlineEntry {
        const exposureName = sanitizeDownloadName(subListing.exposureName, subListing.exposureId || 'exposure');
        const subListingName = titleCaseName(sanitizeDownloadName(subListing.subListingName, 'sub-listing'));
        const csvName = `${this.rootDir(analysisId)}/TS-${subListing.timestep}/${exposureName}/${subListingName}.csv`;
        const csvContent = toCsvContent(subListing.rows, subListing.columns);

        return {
            type: 'inline',
            name: csvName,
            content: csvContent
        };
    }

    private buildArchiveEntries(payload: ExportListingRowsByAnalysisIdOutput): ClusterArchiveInlineEntry[] {
        const entries: ClusterArchiveInlineEntry[] = [];

        if (payload.config !== undefined) {
            entries.push(this.createConfigCsvEntry(payload.analysisId, payload.config));
        }

        for (const listing of payload.listings) {
            entries.push(this.createListingCsvEntry(payload.analysisId, listing));
        }

        for (const subListing of payload.subListings) {
            entries.push(this.createSubListingCsvEntry(payload.analysisId, subListing));
        }

        return entries;
    }

    private presentSingleInlineEntry(payload: ExportListingRowsByAnalysisIdOutput, entry: ClusterArchiveInlineEntry): DownloadStreamOutput {
        const filename = entry.name.split('/').pop() || `AnalysisID-${payload.analysisId}.csv`;

        return createDownloadStreamResponse({
            stream: Readable.from([entry.content]),
            contentType: 'text/csv; charset=utf-8',
            filename
        });
    }

    /** The catalogue never emits an empty config object, so its presence is the whole test. */
    async present(payload: ExportListingRowsByAnalysisIdOutput): Promise<DownloadStreamOutput> {
        if (payload.listings.length <= 1 && payload.subListings.length === 0 && payload.config === undefined) {
            const listing = payload.listings[0] || this.getEmptyListing();
            const listingName = sanitizeDownloadName(listing.listingName, 'listing');

            return createSerializedDownloadResponse({
                filename: `AnalysisID-${payload.analysisId}_${listingName}`,
                format: ExportType.Csv,
                rows: listing.rows,
                columns: listing.columns
            });
        }

        const entries = this.buildArchiveEntries(payload);

        if (!payload.teamClusterId) {
            return this.presentSingleInlineEntry(
                payload,
                entries[0] ?? this.createListingCsvEntry(payload.analysisId, this.getEmptyListing())
            );
        }

        return this.archiveService.createArchiveDownload({
            teamClusterId: payload.teamClusterId,
            outputObjectKey: `exports/listing-rows/${payload.analysisId}/${v4()}.zip`,
            filename: `AnalysisID-${payload.analysisId}.zip`,
            entries
        });
    }
}
