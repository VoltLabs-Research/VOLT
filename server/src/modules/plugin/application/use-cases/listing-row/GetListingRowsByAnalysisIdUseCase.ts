import { mapListingRowByAnalysis } from '@modules/plugin/utilities/mappers/listing-row/mapListingRowByAnalysis';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { IListingRowRepository } from '@modules/plugin/domain/port/listing-row/IListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable, inject } from 'tsyringe';

interface ListingRowsByAnalysisFilter {
    analysis: string;
    team: string;
};

interface DaemonListingRow {
    _id: string;
    plugin?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
    trajectoryName?: string;
    timestep?: number;
    row?: Record<string, unknown>;
    [key: string]: unknown;
};

interface DaemonPaginatedResult {
    data: DaemonListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

const buildListingRowsByAnalysisFilter = (
    input: GetListingRowsByAnalysisIdInputDTO
): ListingRowsByAnalysisFilter => {
    return {
        analysis: input.analysisId,
        team: input.teamId
    };
};

const mapDaemonListingRow = (row: DaemonListingRow): ListingRowByAnalysisData => {
    return {
        _id: row._id || '',
        plugin: String(row.plugin || ''),
        exposureId: row.exposureId || '',
        exposureName: row.exposureName || '',
        trajectory: String(row.trajectory || ''),
        trajectoryName: row.trajectoryName || '',
        timestep: row.timestep ?? 0,
        row: (row.row && typeof row.row === 'object') ? row.row : {}
    };
};

@injectable()
export class GetListingRowsByAnalysisIdUseCase implements IUseCase<GetListingRowsByAnalysisIdInputDTO, GetListingRowsByAnalysisIdOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private daemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: GetListingRowsByAnalysisIdInputDTO): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
        const sortAsc = input.sortAsc ?? false;

        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (analysis?.props.teamCluster) {
            return this.executeFromDaemon(analysis.props.teamCluster, input.analysisId, page, limit);
        }

        const filter = buildListingRowsByAnalysisFilter(input);

        const result = await this.listingRowRepository.findAll({
            filter,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        const data = result.data.map(mapListingRowByAnalysis);

        return Result.ok({
            ...result,
            data
        });
    }

    private async executeFromDaemon(
        teamClusterId: string,
        analysisId: string,
        page: number,
        limit: number
    ): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const daemonResult = await this.daemonClient.request<DaemonPaginatedResult>(
            teamClusterId,
            '/api/plugins/listings',
            {
                query: {
                    analysisId,
                    page,
                    limit
                }
            }
        );

        const data = (daemonResult.data || []).map(mapDaemonListingRow);

        return Result.ok({
            data,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        });
    }
};
