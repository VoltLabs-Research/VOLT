import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import {
    ExportListingRowsByAnalysisIdInputDTO,
    ExportListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { mapListingRowByAnalysis } from './mapListingRowByAnalysis';

interface ListingAggregation {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
};

@injectable()
export class ExportListingRowsByAnalysisIdUseCase implements IUseCase<
    ExportListingRowsByAnalysisIdInputDTO,
    ExportListingRowsByAnalysisIdOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository
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

        const dynamicRow = (listingRow.row && typeof listingRow.row === 'object')
            ? listingRow.row as Record<string, unknown>
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

    async execute(input: ExportListingRowsByAnalysisIdInputDTO): Promise<Result<ExportListingRowsByAnalysisIdOutputDTO>> {
        const sortAsc = input.sortAsc ?? false;
        const format = input.format ?? 'csv';
        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const listingMap = new Map<string, ListingAggregation>();

        do {
            const pageResult = await this.listingRowRepository.findAll({
                filter: {
                    analysis: input.analysisId,
                    team: input.teamId
                } as any,
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

        const listings = Array.from(listingMap.values())
            .sort((a, b) => a.listingName.localeCompare(b.listingName))
            .map((listing) => ({
                listingId: listing.listingId,
                listingName: listing.listingName,
                rows: listing.rows,
                columns: this.buildColumns(listing.dynamicColumns)
            }));

        return Result.ok({
            analysisId: input.analysisId,
            format,
            listings
        });
    }
};

