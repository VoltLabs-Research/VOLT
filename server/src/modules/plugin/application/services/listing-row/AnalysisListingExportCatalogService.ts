import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import {
    AnalysisListingExportOptionDTO,
    AnalysisSubListingExportOptionDTO,
    GetAnalysisListingExportOptionsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import {
    AnalysisListingExportData,
    AnalysisSubListingExportData,
    ExportListingRowsByAnalysisIdInputDTO,
    ExportListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { enrichDaemonListingRows } from '@modules/plugin/application/use-cases/listing-row/listing-row-enrichment';
import { Exporter } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';
import { resolveAnalysisComputeClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ExportType } from '@shared/domain/port/IBaseRepository';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

interface ListingAggregation {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
}

interface DiscoveredSubListingReference {
    id: string;
    plugin: string;
    trajectory: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
}

interface SubListingAggregation {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    timestep: number;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
}

interface SubListingExportRowInput {
    _id: string;
    plugin: string;
    trajectory: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    row: Record<string, unknown>;
}

interface DaemonSubListingRow {
    _id: string;
    plugin?: string;
    trajectory?: string;
    exposureId?: string;
    exposureName?: string;
    timestep?: number;
    subListingName?: string;
    row?: Record<string, unknown>;
    [key: string]: unknown;
}

interface DaemonPaginatedDataResult<TData> {
    data: TData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

interface ExcludedExposureSet {
    ids: Set<string>;
    names: Set<string>;
}

interface AnalysisExportContext {
    analysis: Awaited<ReturnType<IAnalysisRepository['findById']>>;
    teamClusterId?: string;
    excludedExposures: ExcludedExposureSet;
}

export const buildAnalysisListingSelectionId = (listingId: string, listingName: string): string => {
    return `${listingId || 'listing'}::${listingName || listingId || 'listing'}`;
};

export const buildAnalysisSubListingSelectionId = (
    exposureId: string,
    timestep: number,
    subListingName: string
): string => {
    return [exposureId || 'exposure', timestep, subListingName || 'sub-listing'].join('::');
};

const EMPTY_SELECTION_SENTINEL = '__volt_empty_selection__';

@Singleton()
export class AnalysisListingExportCatalogService {
    constructor(
        private readonly analysisRepository: AnalysisRepository,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly pluginRepository: PluginRepository,
        private readonly daemonClient: TeamClusterDaemonClient
    ) {}

    async getExportOptions(analysisId: string): Promise<GetAnalysisListingExportOptionsOutputDTO> {
        const { analysis, teamClusterId, excludedExposures } = await this.resolveContext(analysisId);

        if (!teamClusterId) {
            return {
                analysisId,
                hasConfig: this.hasConfig(analysis?.props.config),
                listings: [],
                subListings: []
            };
        }

        const enrichedRows = await this.collectEnrichedListingRows(teamClusterId, analysisId, excludedExposures);
        const listings = this.buildListingOptions(enrichedRows);
        const subListings = this.buildSubListingOptions(enrichedRows);

        return {
            analysisId,
            hasConfig: this.hasConfig(analysis?.props.config),
            listings,
            subListings
        };
    }

    async buildExportPayload(input: ExportListingRowsByAnalysisIdInputDTO): Promise<ExportListingRowsByAnalysisIdOutputDTO> {
        const format = input.format ?? ExportType.Csv;
        const includeConfig = input.includeConfig ?? true;
        const selectedListingIds = this.normalizeSelectionSet(input.selectedListingIds);
        const selectedSubListingIds = this.normalizeSelectionSet(input.selectedSubListingIds);

        const { analysis, teamClusterId, excludedExposures } = await this.resolveContext(input.analysisId);
        const config = includeConfig ? analysis?.props.config : undefined;

        if (!teamClusterId) {
            return {
                analysisId: input.analysisId,
                format,
                config: this.hasConfig(config) ? config : undefined,
                listings: [],
                subListings: []
            };
        }

        const enrichedRows = await this.collectEnrichedListingRows(teamClusterId, input.analysisId, excludedExposures);
        const listings = this.aggregateListings(
            input.analysisId,
            enrichedRows,
            selectedListingIds
        );
        const subListingReferences = this.discoverSubListingReferences(
            enrichedRows,
            selectedSubListingIds
        );
        const subListings = await this.collectSubListings(
            teamClusterId,
            input.teamId,
            input.analysisId,
            subListingReferences
        );

        return {
            analysisId: input.analysisId,
            format,
            config: this.hasConfig(config) ? config : undefined,
            listings,
            subListings
        };
    }

    private normalizeSelectionSet(selectionIds?: string[]): Set<string> | null {
        if (!selectionIds) {
            return null;
        }

        const ids = selectionIds
            .map((selectionId) => String(selectionId || '').trim())
            .filter(Boolean)
            .filter((selectionId) => selectionId !== EMPTY_SELECTION_SENTINEL);

        return new Set(ids);
    }

    private hasConfig(config: Record<string, unknown> | undefined): config is Record<string, unknown> {
        return config !== undefined && Object.keys(config).length > 0;
    }

    private emptyExcludedExposureSet(): ExcludedExposureSet {
        return {
            ids: new Set<string>(),
            names: new Set<string>()
        };
    }

    private shouldExcludeExposure(
        row: Pick<DaemonListingRow, 'exposureId' | 'exposureName'>,
        excludedExposures: ExcludedExposureSet
    ): boolean {
        if (row.exposureId && excludedExposures.ids.has(String(row.exposureId))) {
            return true;
        }

        if (row.exposureName && excludedExposures.names.has(String(row.exposureName))) {
            return true;
        }

        return false;
    }

    private async resolveExcludedExposures(pluginId?: string): Promise<ExcludedExposureSet> {
        if (!pluginId) {
            return this.emptyExcludedExposureSet();
        }

        const plugin = await this.pluginRepository.findById(pluginId);
        if (!plugin || !Array.isArray(plugin.props.exposures)) {
            return this.emptyExcludedExposureSet();
        }

        return plugin.props.exposures.reduce<ExcludedExposureSet>((accumulator, exposure) => {
            if (exposure?.export?.exporter !== Exporter.Mesh) {
                return accumulator;
            }

            if (typeof exposure._id === 'string' && exposure._id) {
                accumulator.ids.add(exposure._id);
            }

            if (typeof exposure.name === 'string' && exposure.name) {
                accumulator.names.add(exposure.name);
            }

            return accumulator;
        }, this.emptyExcludedExposureSet());
    }

    private async resolveContext(analysisId: string): Promise<AnalysisExportContext> {
        const analysis = await this.analysisRepository.findById(analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId(analysis.props)
            : undefined;
        const excludedExposures = await this.resolveExcludedExposures(analysis?.props.plugin);

        return {
            analysis,
            teamClusterId,
            excludedExposures
        };
    }

    private async collectEnrichedListingRows(
        teamClusterId: string,
        analysisId: string,
        excludedExposures: ExcludedExposureSet
    ): Promise<DaemonListingRow[]> {
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const listingRows: DaemonListingRow[] = [];

        do {
            const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                { analysisId, page, limit: pageSize }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);
            listingRows.push(
                ...(daemonResult.data || []).filter((row) => !this.shouldExcludeExposure(row, excludedExposures))
            );

            page += 1;
        } while (page <= totalPages);

        return enrichDaemonListingRows({
            rows: listingRows,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            fallbackAnalysisId: analysisId
        });
    }

    private buildListingOptions(rows: DaemonListingRow[]): AnalysisListingExportOptionDTO[] {
        const listings = new Map<string, AnalysisListingExportOptionDTO>();

        for (const row of rows) {
            const listingId = row.exposureId || 'listing';
            const listingName = row.exposureName || listingId;
            const id = buildAnalysisListingSelectionId(listingId, listingName);

            if (listings.has(id)) {
                continue;
            }

            listings.set(id, {
                id,
                listingId,
                listingName,
                label: listingName
            });
        }

        return Array.from(listings.values())
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    private buildSubListingOptions(rows: DaemonListingRow[]): AnalysisSubListingExportOptionDTO[] {
        return this.discoverSubListingReferences(rows).map((reference) => ({
            id: reference.id,
            exposureId: reference.exposureId,
            exposureName: reference.exposureName,
            timestep: reference.timestep,
            subListingName: reference.subListingName,
            label: reference.subListingName
        }));
    }

    private toExportRow(analysisId: string, listingRow: ListingRowByAnalysisData): Record<string, unknown> {
        const baseRow: Record<string, unknown> = {
            _id: listingRow._id,
            pluginId: listingRow.plugin,
            analysisId,
            trajectoryId: listingRow.trajectory,
            trajectoryName: listingRow.trajectoryName,
            timestep: listingRow.timestep
        };

        const dynamicRow = listingRow.row && typeof listingRow.row === 'object'
            ? listingRow.row
            : {};

        for (const [key, value] of Object.entries(dynamicRow)) {
            if (!(key in baseRow)) {
                baseRow[key] = value;
            }
        }

        return baseRow;
    }

    private buildColumns(dynamicColumns: Set<string>): string[] {
        return [
            '_id',
            'pluginId',
            'analysisId',
            'trajectoryId',
            'trajectoryName',
            'timestep',
            ...Array.from(dynamicColumns).sort((a, b) => a.localeCompare(b))
        ];
    }

    private toSubListingExportRow(
        analysisId: string,
        row: SubListingExportRowInput
    ): Record<string, unknown> {
        const baseRow: Record<string, unknown> = {
            _id: row._id,
            pluginId: row.plugin,
            analysisId,
            trajectoryId: row.trajectory,
            exposureId: row.exposureId,
            exposureName: row.exposureName,
            timestep: row.timestep,
            subListingName: row.subListingName
        };

        const dynamicRow = row.row && typeof row.row === 'object'
            ? row.row
            : {};

        for (const [key, value] of Object.entries(dynamicRow)) {
            if (!(key in baseRow)) {
                baseRow[key] = value;
            }
        }

        return baseRow;
    }

    private buildSubListingColumns(dynamicColumns: Set<string>): string[] {
        return [
            '_id',
            'pluginId',
            'analysisId',
            'trajectoryId',
            'exposureId',
            'exposureName',
            'timestep',
            'subListingName',
            ...Array.from(dynamicColumns).sort((a, b) => a.localeCompare(b))
        ];
    }

    private aggregateListings(
        analysisId: string,
        rows: DaemonListingRow[],
        selectedListingIds: Set<string> | null
    ): AnalysisListingExportData[] {
        const listingMap = new Map<string, ListingAggregation>();

        for (const doc of rows) {
            const mapped: ListingRowByAnalysisData = {
                _id: doc._id || '',
                plugin: String(doc.plugin || ''),
                exposureId: doc.exposureId || '',
                exposureName: doc.exposureName || '',
                trajectory: String(doc.trajectory || ''),
                trajectoryName: doc.trajectoryName as string,
                timestep: doc.timestep ?? 0,
                row: (doc.row && typeof doc.row === 'object') ? doc.row : {}
            };

            const listingId = mapped.exposureId || 'listing';
            const listingName = mapped.exposureName || listingId;
            const selectionId = buildAnalysisListingSelectionId(listingId, listingName);
            if (selectedListingIds && !selectedListingIds.has(selectionId)) {
                continue;
            }

            const aggregated = listingMap.get(selectionId) || {
                listingId,
                listingName,
                rows: [],
                dynamicColumns: new Set<string>()
            };

            const exportRow = this.toExportRow(analysisId, mapped);
            aggregated.rows.push(exportRow);

            Object.keys(exportRow).forEach((column) => {
                if (!['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep'].includes(column)) {
                    aggregated.dynamicColumns.add(column);
                }
            });

            listingMap.set(selectionId, aggregated);
        }

        return Array.from(listingMap.values())
            .sort((left, right) => left.listingName.localeCompare(right.listingName))
            .map((listing) => ({
                listingId: listing.listingId,
                listingName: listing.listingName,
                rows: listing.rows,
                columns: this.buildColumns(listing.dynamicColumns)
            }));
    }

    private discoverSubListingReferences(
        rows: DaemonListingRow[],
        selectedSubListingIds: Set<string> | null = null
    ): DiscoveredSubListingReference[] {
        const references = new Map<string, DiscoveredSubListingReference>();

        for (const row of rows) {
            if (!Array.isArray(row.subListingNames) || row.subListingNames.length === 0) {
                continue;
            }

            const exposureId = row.exposureId || '';
            const exposureName = row.exposureName || exposureId;
            const plugin = String(row.plugin || '');
            const trajectory = String(row.trajectory || '');
            const timestep = row.timestep ?? 0;

            for (const subListingName of row.subListingNames.map(String).filter(Boolean)) {
                const id = buildAnalysisSubListingSelectionId(exposureId, timestep, subListingName);

                if (selectedSubListingIds && !selectedSubListingIds.has(id)) {
                    continue;
                }

                if (references.has(id)) {
                    continue;
                }

                references.set(id, {
                    id,
                    plugin,
                    trajectory,
                    exposureId,
                    exposureName,
                    timestep,
                    subListingName
                });
            }
        }

        return Array.from(references.values()).sort((left, right) => {
            const exposureComparison = left.exposureName.localeCompare(right.exposureName);
            if (exposureComparison !== 0) {
                return exposureComparison;
            }

            const timestepComparison = left.timestep - right.timestep;
            if (timestepComparison !== 0) {
                return timestepComparison;
            }

            return left.subListingName.localeCompare(right.subListingName);
        });
    }

    private async collectSubListingRows(
        teamClusterId: string,
        teamId: string,
        analysisId: string,
        reference: DiscoveredSubListingReference
    ): Promise<SubListingExportRowInput[]> {
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const rows: SubListingExportRowInput[] = [];

        do {
            const daemonResult = await this.daemonClient.command<DaemonPaginatedDataResult<DaemonSubListingRow>>(
                teamClusterId,
                ChannelCommands.PluginSubListingsList,
                {
                    teamId,
                    analysisId,
                    exposureId: reference.exposureId,
                    timestep: reference.timestep,
                    subListingName: reference.subListingName,
                    page,
                    limit: pageSize
                }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);

            for (const doc of daemonResult.data || []) {
                rows.push({
                    _id: doc._id || '',
                    plugin: reference.plugin,
                    trajectory: reference.trajectory,
                    exposureId: reference.exposureId,
                    exposureName: reference.exposureName,
                    timestep: reference.timestep,
                    subListingName: reference.subListingName,
                    row: (doc.row && typeof doc.row === 'object') ? doc.row : {}
                });
            }

            page += 1;
        } while (page <= totalPages);

        return rows;
    }

    private async collectSubListings(
        teamClusterId: string,
        teamId: string,
        analysisId: string,
        references: DiscoveredSubListingReference[]
    ): Promise<AnalysisSubListingExportData[]> {
        if (references.length === 0) {
            return [];
        }

        const allRows = (
            await Promise.all(references.map((reference) => this.collectSubListingRows(
                teamClusterId,
                teamId,
                analysisId,
                reference
            )))
        ).flat();

        const subListingMap = new Map<string, SubListingAggregation>();

        for (const row of allRows) {
            const key = buildAnalysisSubListingSelectionId(row.exposureId, row.timestep, row.subListingName);
            const aggregated = subListingMap.get(key) || {
                exposureId: row.exposureId,
                exposureName: row.exposureName,
                subListingName: row.subListingName,
                timestep: row.timestep,
                rows: [],
                dynamicColumns: new Set<string>()
            };

            const exportRow = this.toSubListingExportRow(analysisId, row);
            aggregated.rows.push(exportRow);

            Object.keys(exportRow).forEach((column) => {
                if (!['_id', 'pluginId', 'analysisId', 'trajectoryId', 'exposureId', 'exposureName', 'timestep', 'subListingName'].includes(column)) {
                    aggregated.dynamicColumns.add(column);
                }
            });

            subListingMap.set(key, aggregated);
        }

        return Array.from(subListingMap.values())
            .sort((left, right) => {
                const exposureComparison = left.exposureName.localeCompare(right.exposureName);
                if (exposureComparison !== 0) return exposureComparison;

                const subListingComparison = left.subListingName.localeCompare(right.subListingName);
                if (subListingComparison !== 0) return subListingComparison;

                return left.timestep - right.timestep;
            })
            .map((subListing) => ({
                exposureId: subListing.exposureId,
                exposureName: subListing.exposureName,
                subListingName: subListing.subListingName,
                timestep: subListing.timestep,
                rows: subListing.rows,
                columns: this.buildSubListingColumns(subListing.dynamicColumns)
            }));
    }
}
