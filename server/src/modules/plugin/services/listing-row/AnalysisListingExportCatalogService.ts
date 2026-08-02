import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import type { DaemonListingRow } from '@modules/plugin/services/listing-row/DaemonListingMapper';
import { collectAllDaemonPages } from '@modules/plugin/services/listing-row/DaemonListingPager';
import {
    aggregateListingTables,
    buildListingExportOptions
} from '@modules/plugin/services/listing-row/ListingTableAggregation';
import {
    SubListingExportCollector,
    discoverSubListingReferences
} from '@modules/plugin/services/listing-row/SubListingExportCollector';
import type {
    ExportListingRowsByAnalysisIdInput,
    ExportListingRowsByAnalysisIdOutput,
    GetAnalysisListingExportOptionsOutput
} from '@modules/plugin/services/listing-row/ListingRowTypes';
import { enrichDaemonListingRows } from '@modules/plugin/services/listing-row/ListingRowEnrichmentService';
import { Exporter } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import AnalysisEntity from '@modules/analysis/models/Analysis';

const EMPTY_SELECTION_SENTINEL = '__volt_empty_selection__';

interface ExcludedExposureSet {
    ids: Set<string>;
    names: Set<string>;
}

interface AnalysisExportContext {
    analysis: AnalysisEntity | null;
    teamClusterId?: string;
    excludedExposures: ExcludedExposureSet;
}

const hasConfig = (config: Record<string, unknown> | undefined): config is Record<string, unknown> => {
    return config !== undefined && Object.keys(config).length > 0;
};

const emptyExcludedExposures = (): ExcludedExposureSet => ({
    ids: new Set<string>(),
    names: new Set<string>()
});

/** An absent selection means "export everything"; an empty one means "nothing". */
const normalizeSelectionSet = (selectionIds?: string[]): Set<string> | null => {
    if (!selectionIds) {
        return null;
    }

    return new Set(
        selectionIds
            .map((selectionId) => selectionId.trim())
            .filter((selectionId) => selectionId && selectionId !== EMPTY_SELECTION_SENTINEL)
    );
};

/**
 * Catalogues what an analysis can export and materialises the selected listings,
 * delegating the row folding to ListingTableAggregation and the nested
 * sub-listings to SubListingExportCollector.
 */
export class AnalysisListingExportCatalogService {
    #subListingCollector: SubListingExportCollector;

    constructor(
        private readonly daemonClient: ITeamClusterDaemonClient
    ) {
        this.#subListingCollector = new SubListingExportCollector(daemonClient);
    }

    async getExportOptions(analysisId: string): Promise<GetAnalysisListingExportOptionsOutput> {
        const { analysis, teamClusterId, excludedExposures } = await this.resolveContext(analysisId);
        const rows = await this.collectEnrichedListingRows(teamClusterId, analysisId, excludedExposures);

        return {
            analysisId,
            hasConfig: hasConfig(analysis?.config),
            listings: buildListingExportOptions(rows),
            subListings: discoverSubListingReferences(rows).map((reference) => ({
                id: reference.id,
                exposureId: reference.exposureId,
                exposureName: reference.exposureName,
                timestep: reference.timestep,
                subListingName: reference.subListingName,
                label: reference.subListingName
            }))
        };
    }

    async buildExportPayload(input: ExportListingRowsByAnalysisIdInput): Promise<ExportListingRowsByAnalysisIdOutput> {
        const { analysis, teamClusterId, excludedExposures } = await this.resolveContext(input.analysisId);
        const config = (input.includeConfig ?? true) ? analysis?.config : undefined;
        const rows = await this.collectEnrichedListingRows(teamClusterId, input.analysisId, excludedExposures);

        return {
            analysisId: input.analysisId,
            teamClusterId,
            config: hasConfig(config) ? config : undefined,
            listings: aggregateListingTables(
                input.analysisId,
                rows,
                normalizeSelectionSet(input.selectedListingIds)
            ),
            subListings: teamClusterId
                ? await this.#subListingCollector.collect(
                    teamClusterId,
                    input.teamId,
                    input.analysisId,
                    discoverSubListingReferences(rows, normalizeSelectionSet(input.selectedSubListingIds))
                )
                : []
        };
    }

    private shouldExcludeExposure(row: DaemonListingRow, excluded: ExcludedExposureSet): boolean {
        return Boolean(row.exposureId && excluded.ids.has(row.exposureId))
            || Boolean(row.exposureName && excluded.names.has(row.exposureName));
    }

    /** Mesh exposures carry geometry rather than tabular rows, so they never export. */
    private async resolveExcludedExposures(pluginId?: string): Promise<ExcludedExposureSet> {
        if (!pluginId) {
            return emptyExcludedExposures();
        }

        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        const exposures = pluginEntity ? toPluginLike(pluginEntity).props.exposures ?? [] : [];

        return exposures.reduce<ExcludedExposureSet>((accumulator, exposure) => {
            if (exposure.export?.exporter !== Exporter.Mesh) {
                return accumulator;
            }

            if (exposure._id) {
                accumulator.ids.add(exposure._id);
            }

            if (exposure.name) {
                accumulator.names.add(exposure.name);
            }

            return accumulator;
        }, emptyExcludedExposures());
    }

    private async resolveContext(analysisId: string): Promise<AnalysisExportContext> {
        const analysis = await AnalysisEntity.findOneBy({ id: analysisId });

        return {
            analysis,
            teamClusterId: analysis?.computeClusterId ?? undefined,
            excludedExposures: await this.resolveExcludedExposures(analysis?.plugin)
        };
    }

    private async collectEnrichedListingRows(
        teamClusterId: string | undefined,
        analysisId: string,
        excludedExposures: ExcludedExposureSet
    ): Promise<DaemonListingRow[]> {
        if (!teamClusterId) {
            return [];
        }

        const listingRows = await collectAllDaemonPages<DaemonListingRow>(
            this.daemonClient,
            teamClusterId,
            ChannelCommands.PluginListingsList,
            { analysisId }
        );

        return enrichDaemonListingRows({
            rows: listingRows.filter((row) => !this.shouldExcludeExposure(row, excludedExposures)),
            fallbackAnalysisId: analysisId
        });
    }
}
