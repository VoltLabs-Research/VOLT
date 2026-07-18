import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type {
    IClusterObjectArchiveService,
    ClusterArchiveInlineEntry
} from '@shared/contracts/ports';
import { toCsvContent } from '@modules/plugin/utilities/listing-row/csv';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import {
    createDownloadStreamResponse,
    createSerializedDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';

import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';

import type {
    AnalysisListingExportData,
    AnalysisSubListingExportData,
    ExportListingRowsByAnalysisIdOutputDTO
} from '@modules/plugin/utilities/listing-row/listing-row-types';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

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
    constructor(
        @inject(CLUSTER_ACCESS_TOKENS.ClusterObjectArchiveService)
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
            columns: ['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep']
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

    private hasConfig(config: Record<string, unknown> | undefined): config is Record<string, unknown> {
        return config !== undefined && Object.keys(config).length > 0;
    }

    private buildArchiveEntries(payload: ExportListingRowsByAnalysisIdOutputDTO): ClusterArchiveInlineEntry[] {
        const entries: ClusterArchiveInlineEntry[] = [];

        if (this.hasConfig(payload.config)) {
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

    private presentSingleInlineEntry(payload: ExportListingRowsByAnalysisIdOutputDTO, entry: ClusterArchiveInlineEntry): DownloadStreamOutputDTO {
        const filename = entry.name.split('/').pop() || `AnalysisID-${payload.analysisId}.csv`;

        return createDownloadStreamResponse({
            stream: Readable.from([entry.content]),
            contentType: 'text/csv; charset=utf-8',
            filename
        });
    }

    async present(payload: ExportListingRowsByAnalysisIdOutputDTO): Promise<DownloadStreamOutputDTO> {
        const hasConfig = this.hasConfig(payload.config);

        if (payload.listings.length <= 1 && payload.subListings.length === 0 && !hasConfig) {
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
