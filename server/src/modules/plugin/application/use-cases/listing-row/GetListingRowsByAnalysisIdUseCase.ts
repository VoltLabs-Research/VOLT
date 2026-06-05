import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { enrichDaemonListingRows } from '@modules/plugin/application/use-cases/listing-row/listing-row-enrichment';
import { resolveListingPagination } from '@modules/plugin/application/use-cases/listing-row/listing-row-pagination';
import { resolveAnalysisComputeClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

const mapDaemonListingRow = (row: DaemonListingRow): ListingRowByAnalysisData => {
    return {
        _id: row._id || '',
        plugin: String(row.plugin || ''),
        exposureId: row.exposureId || '',
        exposureName: row.exposureName || '',
        trajectory: String(row.trajectory || ''),
        trajectoryName: row.trajectoryName as string,
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
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: GetListingRowsByAnalysisIdInputDTO): Promise<Result<GetListingRowsByAnalysisIdOutputDTO>> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await this.analysisRepository.findById(input.analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId(analysis.props)
            : undefined;
        if (!teamClusterId) {
            return Result.ok(EMPTY_RESULT);
        }

        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            ChannelCommands.PluginListingsList,
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                page,
                limit
            }
        );

        const rows = await enrichDaemonListingRows({
            rows: daemonResult.data || [],
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            fallbackAnalysisId: input.analysisId
        });
        const data = rows.map(mapDaemonListingRow);

        return Result.ok({
            data,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        });
    }
}
