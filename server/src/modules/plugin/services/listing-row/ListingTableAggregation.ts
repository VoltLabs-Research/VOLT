import {
    mapDaemonRowByAnalysis,
    type DaemonListingRow
} from '@modules/plugin/services/listing-row/DaemonListingMapper';
import {
    buildExportColumns,
    collectExportRow,
    type RowAggregation
} from '@modules/plugin/services/listing-row/ExportRowAggregation';
import type {
    AnalysisListingExportData,
    GetAnalysisListingExportOptionsOutput
} from '@modules/plugin/services/listing-row/ListingRowTypes';

type ListingExportOption = GetAnalysisListingExportOptionsOutput['listings'][number];

export const LISTING_COLUMNS = [
    '_id',
    'pluginId',
    'analysisId',
    'trajectoryId',
    'trajectoryName',
    'timestep'
];

interface ListingAggregation extends RowAggregation {
    listingId: string;
    listingName: string;
}

/** A listing is identified by its exposure; an unnamed exposure falls back to a stable literal. */
const listingIdentityOf = (row: { exposureId?: string; exposureName?: string }) => {
    const listingId = row.exposureId || 'listing';
    const listingName = row.exposureName || listingId;

    return {
        listingId,
        listingName,
        selectionId: `${listingId}::${listingName}`
    };
};

/** One option per distinct exposure the rows came from, so the client can pick what to export. */
export const buildListingExportOptions = (rows: DaemonListingRow[]): ListingExportOption[] => {
    const listings = new Map<string, ListingExportOption>();

    for (const row of rows) {
        const { listingId, listingName, selectionId } = listingIdentityOf(row);

        if (!listings.has(selectionId)) {
            listings.set(selectionId, {
                id: selectionId,
                listingId,
                listingName,
                label: listingName
            });
        }
    }

    return Array.from(listings.values())
        .sort((left, right) => left.label.localeCompare(right.label));
};

/**
 * Folds the rows into one table per selected listing: the identity columns are
 * fixed and lead every row, and whatever else the row carried becomes a dynamic
 * column of that table.
 */
export const aggregateListingTables = (
    analysisId: string,
    rows: DaemonListingRow[],
    selectedListingIds: Set<string> | null
): AnalysisListingExportData[] => {
    const listingMap = new Map<string, ListingAggregation>();

    for (const doc of rows) {
        const listingRow = mapDaemonRowByAnalysis(doc);
        const { listingId, listingName, selectionId } = listingIdentityOf(listingRow);
        if (selectedListingIds && !selectedListingIds.has(selectionId)) {
            continue;
        }

        const aggregated = listingMap.get(selectionId) ?? {
            listingId,
            listingName,
            rows: [],
            dynamicColumns: new Set<string>()
        };

        collectExportRow(aggregated, {
            _id: listingRow._id,
            pluginId: listingRow.plugin,
            analysisId,
            trajectoryId: listingRow.trajectory,
            trajectoryName: listingRow.trajectoryName,
            timestep: listingRow.timestep
        }, listingRow.row, LISTING_COLUMNS);

        listingMap.set(selectionId, aggregated);
    }

    return Array.from(listingMap.values())
        .sort((left, right) => left.listingName.localeCompare(right.listingName))
        .map((listing) => ({
            listingId: listing.listingId,
            listingName: listing.listingName,
            rows: listing.rows,
            columns: buildExportColumns(LISTING_COLUMNS, listing.dynamicColumns)
        }));
};
