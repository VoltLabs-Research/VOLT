import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { resolveListingPagination } from '@modules/plugin/application/use-cases/listing-row/listing-row-pagination';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable, inject } from 'tsyringe';

import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

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

const EMPTY_RESULT: GetListingRowsByAnalysisIdOutputDTO = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
};

@injectable()
export class GetListingRowsByAnalysisIdUseCase implements IUseCase<GetListingRowsByAnalysisIdInputDTO, GetListingRowsByAnalysisIdOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private daemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: GetListingRowsByAnalysisIdInputDTO): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis?.props.teamCluster) {
            return Result.ok(EMPTY_RESULT);
        }

        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            analysis.props.teamCluster,
            'plugin.listings.list',
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                page,
                limit
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
