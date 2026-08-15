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
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import AnalysisEntity from '@modules/analysis/models/Analysis';

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
        const config = analysis?.config;
        const rows = await this.collectEnrichedListingRows(teamClusterId, input.analysisId, excludedExposures);

        return {
            analysisId: input.analysisId,
            teamClusterId,
            config: hasConfig(config) ? config : undefined,
            listings: aggregateListingTables(input.analysisId, rows),
            subListings: teamClusterId
                ? await this.#subListingCollector.collect(
                    teamClusterId,
                    input.teamId,
                    input.analysisId,
                    discoverSubListingReferences(rows)
                )
                : []
        };
    }

    private shouldExcludeExposure(row: DaemonListingRow, excluded: ExcludedExposureSet): boolean {
        return Boolean(row.exposureId && excluded.ids.has(row.exposureId))
            || Boolean(row.exposureName && excluded.names.has(row.exposureName));
    }

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
