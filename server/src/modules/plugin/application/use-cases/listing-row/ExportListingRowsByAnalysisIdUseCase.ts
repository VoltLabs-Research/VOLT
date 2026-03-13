import {
    ExportListingRowsByAnalysisIdInputDTO,
    ExportListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData,
    AnalysisSubListingExportData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable, inject } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { IListingRowsExportPresenter } from '@modules/plugin/domain/port/listing-row/IListingRowsExportPresenter';

interface ListingAggregation {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
};

interface SubListingAggregation {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    timestep: number;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
};

interface SubListingExportRowInput {
    _id: string;
    plugin: string;
    trajectory: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    row: Record<string, unknown>;
};

interface DaemonListingRow {
    _id: string;
    plugin?: string;
    trajectory?: string;
    exposureId?: string;
    exposureName?: string;
    trajectoryName?: string;
    timestep?: number;
    row?: Record<string, unknown>;
    [key: string]: unknown;
};

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
};

interface DaemonPaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

@injectable()
export class ExportListingRowsByAnalysisIdUseCase implements IUseCase<
    ExportListingRowsByAnalysisIdInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowsExportPresenter)
        private readonly listingRowsExportPresenter: IListingRowsExportPresenter,
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private daemonClient: TeamClusterDaemonClient
    ) {}

    private toExportRow(analysisId: string, listingRow: ListingRowByAnalysisData): Record<string, unknown> {
        const baseRow: Record<string, unknown> = {
            _id: listingRow._id,
            pluginId: listingRow.plugin,
            analysisId,
            trajectoryId: listingRow.trajectory,
            trajectoryName: listingRow.trajectoryName,
            timestep: listingRow.timestep
        };

        let dynamicRow: Record<string, unknown> = {};
        if (listingRow.row && typeof listingRow.row === 'object') {
            dynamicRow = listingRow.row;
        }

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

        let dynamicRow: Record<string, unknown> = {};
        if (row.row && typeof row.row === 'object') {
            dynamicRow = row.row;
        }

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

    private aggregateListingRow(
        listingMap: Map<string, ListingAggregation>,
        analysisId: string,
        mapped: ListingRowByAnalysisData
    ): void {
        const listingId = mapped.exposureId || 'listing';
        const listingName = mapped.exposureName || listingId;
        const key = `${listingId}::${listingName}`;
        const aggregated = listingMap.get(key) || {
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

        listingMap.set(key, aggregated);
    }

    private finalizeListingMap(listingMap: Map<string, ListingAggregation>): ExportListingRowsByAnalysisIdOutputDTO['listings'] {
        return Array.from(listingMap.values())
            .sort((a, b) => a.listingName.localeCompare(b.listingName))
            .map((listing) => ({
                listingId: listing.listingId,
                listingName: listing.listingName,
                rows: listing.rows,
                columns: this.buildColumns(listing.dynamicColumns)
            }));
    }

    private async collectListings(
        teamClusterId: string,
        analysisId: string
    ): Promise<ExportListingRowsByAnalysisIdOutputDTO['listings']> {
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const listingMap = new Map<string, ListingAggregation>();

        do {
            const daemonResult = await this.daemonClient.command<DaemonPaginatedResult<DaemonListingRow>>(
                teamClusterId,
                'plugin.listings.list',
                { analysisId, page, limit: pageSize }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);

            for (const doc of (daemonResult.data || [])) {
                const mapped: ListingRowByAnalysisData = {
                    _id: doc._id || '',
                    plugin: String(doc.plugin || ''),
                    exposureId: doc.exposureId || '',
                    exposureName: doc.exposureName || '',
                    trajectory: String(doc.trajectory || ''),
                    trajectoryName: doc.trajectoryName || '',
                    timestep: doc.timestep ?? 0,
                    row: (doc.row && typeof doc.row === 'object') ? doc.row : {}
                };
                this.aggregateListingRow(listingMap, analysisId, mapped);
            }

            page += 1;
        } while (page <= totalPages);

        return this.finalizeListingMap(listingMap);
    }

    private async collectSubListings(
        teamClusterId: string,
        analysisId: string
    ): Promise<AnalysisSubListingExportData[]> {
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const allRows: SubListingExportRowInput[] = [];

        do {
            const daemonResult = await this.daemonClient.command<DaemonPaginatedResult<DaemonSubListingRow>>(
                teamClusterId,
                'plugin.sub-listings.list',
                { analysisId, page, limit: pageSize }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);

            for (const doc of (daemonResult.data || [])) {
                allRows.push({
                    _id: doc._id || '',
                    plugin: String(doc.plugin || ''),
                    trajectory: String(doc.trajectory || ''),
                    exposureId: doc.exposureId || '',
                    exposureName: doc.exposureName || '',
                    timestep: doc.timestep ?? 0,
                    subListingName: doc.subListingName || '',
                    row: (doc.row && typeof doc.row === 'object') ? doc.row : {}
                });
            }

            page += 1;
        } while (page <= totalPages);

        return this.aggregateSubListingRows(analysisId, allRows);
    }

    private aggregateSubListingRows(
        analysisId: string,
        rows: SubListingExportRowInput[]
    ): AnalysisSubListingExportData[] {
        const subListingMap = new Map<string, SubListingAggregation>();

        for (const row of rows) {
            const key = [row.exposureId, row.subListingName, row.timestep].join('::');

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

    async execute(input: ExportListingRowsByAnalysisIdInputDTO): Promise<Result<DownloadStreamOutputDTO>> {
        const format = input.format ?? ExportType.Csv;

        const analysis = await this.analysisRepository.findById(input.analysisId);
        const teamClusterId = analysis?.props.teamCluster;

        if (!teamClusterId) {
            const payload: ExportListingRowsByAnalysisIdOutputDTO = {
                analysisId: input.analysisId,
                format,
                listings: [],
                subListings: []
            };
            return Result.ok(this.listingRowsExportPresenter.present(payload));
        }

        const [listings, subListings] = await Promise.all([
            this.collectListings(teamClusterId, input.analysisId),
            this.collectSubListings(teamClusterId, input.analysisId)
        ]);

        const payload: ExportListingRowsByAnalysisIdOutputDTO = {
            analysisId: input.analysisId,
            format,
            config: analysis?.props.config,
            listings,
            subListings
        };

        return Result.ok(this.listingRowsExportPresenter.present(payload));
    }
};
