import { mapListingRowByAnalysis } from '@modules/plugin/utilities/mappers/listing-row/mapListingRowByAnalysis';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    ExportListingRowsByAnalysisIdInputDTO,
    ExportListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData,
    AnalysisSubListingExportData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { IListingRowRepository } from '@modules/plugin/domain/port/listing-row/IListingRowRepository';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { IListingRowsExportPresenter } from '@modules/plugin/domain/port/listing-row/IListingRowsExportPresenter';

interface ListingAggregation {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
};

interface ListingRowsByAnalysisFilter {
    analysis: string;
    team: string;
};

interface SubListingRowsByAnalysisFilter {
    analysis: string;
    team: string;
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

const buildListingRowsByAnalysisFilter = (
    input: ExportListingRowsByAnalysisIdInputDTO
): ListingRowsByAnalysisFilter => {
    return {
        analysis: input.analysisId,
        team: input.teamId
    };
};

const buildSubListingRowsByAnalysisFilter = (
    input: ExportListingRowsByAnalysisIdInputDTO
): SubListingRowsByAnalysisFilter => {
    return {
        analysis: input.analysisId,
        team: input.teamId
    };
};

@injectable()
export class ExportListingRowsByAnalysisIdUseCase implements IUseCase<
    ExportListingRowsByAnalysisIdInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository,
        @inject(PLUGIN_TOKENS.SubListingRowRepository) private subListingRowRepository: ISubListingRowRepository,
        @inject(PLUGIN_TOKENS.ListingRowsExportPresenter)
        private readonly listingRowsExportPresenter: IListingRowsExportPresenter
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

    private async collectListings(input: ExportListingRowsByAnalysisIdInputDTO): Promise<ExportListingRowsByAnalysisIdOutputDTO['listings']> {
        const sortAsc = input.sortAsc ?? false;
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const listingMap = new Map<string, ListingAggregation>();
        const filter = buildListingRowsByAnalysisFilter(input);

        do {
            const pageResult = await this.listingRowRepository.findAll({
                filter,
                limit: pageSize,
                page,
                sort: {
                    timestep: sortAsc ? 1 : -1,
                    _id: sortAsc ? 1 : -1
                },
                populate: 'trajectory'
            });

            totalPages = Math.max(1, pageResult.totalPages || 1);

            for (const document of pageResult.data) {
                const mapped = mapListingRowByAnalysis(document);
                const listingId = mapped.exposureId || 'listing';
                const listingName = mapped.exposureName || listingId;
                const key = `${listingId}::${listingName}`;
                const aggregated = listingMap.get(key) || {
                    listingId,
                    listingName,
                    rows: [],
                    dynamicColumns: new Set<string>()
                };

                const exportRow = this.toExportRow(input.analysisId, mapped);
                aggregated.rows.push(exportRow);

                Object.keys(exportRow).forEach((column) => {
                    if (!['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep'].includes(column)) {
                        aggregated.dynamicColumns.add(column);
                    }
                });

                listingMap.set(key, aggregated);
            }

            page += 1;
        } while (page <= totalPages);

        return Array.from(listingMap.values())
            .sort((a, b) => a.listingName.localeCompare(b.listingName))
            .map((listing) => ({
                listingId: listing.listingId,
                listingName: listing.listingName,
                rows: listing.rows,
                columns: this.buildColumns(listing.dynamicColumns)
            }));
    }

    private async collectSubListings(
        input: ExportListingRowsByAnalysisIdInputDTO
    ): Promise<AnalysisSubListingExportData[]> {
        const filter = buildSubListingRowsByAnalysisFilter(input);
        const rows = await this.subListingRowRepository.export({
            filter,
            sort: {
                exposureName: 1,
                subListingName: 1,
                timestep: 1,
                _id: 1
            }
        });

        const subListingMap = new Map<string, SubListingAggregation>();

        for (const document of rows) {
            const key = [
                document.props.exposureId,
                document.props.subListingName,
                document.props.timestep
            ].join('::');

            const aggregated = subListingMap.get(key) || {
                exposureId: document.props.exposureId,
                exposureName: document.props.exposureName,
                subListingName: document.props.subListingName,
                timestep: document.props.timestep,
                rows: [],
                dynamicColumns: new Set<string>()
            };

            const exportRow = this.toSubListingExportRow(input.analysisId, {
                _id: document._id,
                plugin: String(document.props.plugin),
                trajectory: String(document.props.trajectory),
                exposureId: document.props.exposureId,
                exposureName: document.props.exposureName,
                timestep: document.props.timestep,
                subListingName: document.props.subListingName,
                row: document.props.row || {}
            });

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
        const listings = await this.collectListings(input);
        const subListings = await this.collectSubListings(input);

        const payload: ExportListingRowsByAnalysisIdOutputDTO = {
            analysisId: input.analysisId,
            format,
            listings,
            subListings
        };

        return Result.ok(this.listingRowsExportPresenter.present(payload));
    }
};
