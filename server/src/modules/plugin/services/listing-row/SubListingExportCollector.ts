import {
    toListingRowId,
    type DaemonListingRow,
    type DaemonSubListingRow
} from '@modules/plugin/services/listing-row/DaemonListingMapper';
import { collectAllDaemonPages } from '@modules/plugin/services/listing-row/DaemonListingPager';
import {
    buildExportColumns,
    collectExportRow,
    type RowAggregation
} from '@modules/plugin/services/listing-row/ExportRowAggregation';
import type { AnalysisSubListingExportData } from '@modules/plugin/services/listing-row/ListingRowTypes';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';

const SUB_LISTING_COLUMNS = [
    '_id',
    'pluginId',
    'analysisId',
    'trajectoryId',
    'exposureId',
    'exposureName',
    'timestep',
    'subListingName'
];

interface SubListingReference {
    id: string;
    plugin: string;
    trajectory: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
}

interface SubListingExportRow extends SubListingReference {
    _id: string;
    row: Record<string, unknown>;
}

interface SubListingAggregation extends RowAggregation {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    timestep: number;
}

const subListingSelectionId = (
    exposureId: string,
    timestep: number,
    subListingName: string
): string => {
    return [exposureId || 'exposure', timestep, subListingName || 'sub-listing'].join('::');
};

/**
 * A listing row advertises the sub-listings it drills down into, so the set of
 * exportable sub-listings is discovered from the rows themselves rather than
 * configured anywhere.
 */
export const discoverSubListingReferences = (
    rows: DaemonListingRow[],
    selectedIds: Set<string> | null = null
): SubListingReference[] => {
    const references = new Map<string, SubListingReference>();

    for (const row of rows) {
        const exposureId = row.exposureId || '';
        const timestep = row.timestep ?? 0;

        for (const subListingName of (row.subListingNames ?? []).filter(Boolean)) {
            const id = subListingSelectionId(exposureId, timestep, subListingName);

            if (references.has(id) || (selectedIds && !selectedIds.has(id))) {
                continue;
            }

            references.set(id, {
                id,
                plugin: row.plugin || '',
                trajectory: row.trajectory || '',
                exposureId,
                exposureName: row.exposureName || exposureId,
                timestep,
                subListingName
            });
        }
    }

    return Array.from(references.values()).sort((left, right) => {
        return left.exposureName.localeCompare(right.exposureName)
            || left.timestep - right.timestep
            || left.subListingName.localeCompare(right.subListingName);
    });
};

/**
 * Materialises the discovered sub-listings: every reference is paged out of the
 * compute cluster's daemon in parallel and folded back into one table per
 * (exposure, timestep, sub-listing).
 */
export class SubListingExportCollector {
    constructor(
        private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async collect(
        teamClusterId: string,
        teamId: string,
        analysisId: string,
        references: SubListingReference[]
    ): Promise<AnalysisSubListingExportData[]> {
        if (references.length === 0) {
            return [];
        }

        const allRows = (
            await Promise.all(references.map((reference) => this.fetchRows(
                teamClusterId,
                teamId,
                analysisId,
                reference
            )))
        ).flat();

        const subListingMap = new Map<string, SubListingAggregation>();

        for (const row of allRows) {
            const key = subListingSelectionId(row.exposureId, row.timestep, row.subListingName);
            const aggregated = subListingMap.get(key) ?? {
                exposureId: row.exposureId,
                exposureName: row.exposureName,
                subListingName: row.subListingName,
                timestep: row.timestep,
                rows: [],
                dynamicColumns: new Set<string>()
            };

            collectExportRow(aggregated, {
                _id: row._id,
                pluginId: row.plugin,
                analysisId,
                trajectoryId: row.trajectory,
                exposureId: row.exposureId,
                exposureName: row.exposureName,
                timestep: row.timestep,
                subListingName: row.subListingName
            }, row.row, SUB_LISTING_COLUMNS);

            subListingMap.set(key, aggregated);
        }

        return Array.from(subListingMap.values())
            .sort((left, right) => {
                return left.exposureName.localeCompare(right.exposureName)
                    || left.subListingName.localeCompare(right.subListingName)
                    || left.timestep - right.timestep;
            })
            .map((subListing) => ({
                exposureId: subListing.exposureId,
                exposureName: subListing.exposureName,
                subListingName: subListing.subListingName,
                timestep: subListing.timestep,
                rows: subListing.rows,
                columns: buildExportColumns(SUB_LISTING_COLUMNS, subListing.dynamicColumns)
            }));
    }

    private async fetchRows(
        teamClusterId: string,
        teamId: string,
        analysisId: string,
        reference: SubListingReference
    ): Promise<SubListingExportRow[]> {
        const docs = await collectAllDaemonPages<DaemonSubListingRow>(
            this.daemonClient,
            teamClusterId,
            ChannelCommands.PluginSubListingsList,
            {
                teamId,
                analysisId,
                exposureId: reference.exposureId,
                timestep: reference.timestep,
                subListingName: reference.subListingName
            }
        );

        return docs.map((doc) => ({
            ...reference,
            _id: toListingRowId(doc._id),
            row: doc.row ?? {}
        }));
    }
}
