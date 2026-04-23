import {
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { enrichDaemonListingRows } from '@modules/plugin/application/use-cases/listing-row/listing-row-enrichment';
import { resolveListingPagination } from '@modules/plugin/application/use-cases/listing-row/listing-row-pagination';
import { resolveAnalysisComputeClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable } from 'tsyringe';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

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
        private analysisRepository: AnalysisRepository,
        private trajectoryRepository: TrajectoryRepository,
        private daemonClient: TeamClusterDaemonClient
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
};
