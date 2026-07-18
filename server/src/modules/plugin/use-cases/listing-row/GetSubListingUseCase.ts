import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/dtos/listing-row/GetSubListingDTO';
import { resolveListingPagination } from '@modules/plugin/use-cases/listing-row/listing-row-pagination';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetSubListingUseCase } from '@shared/contracts/ports/IGetSubListingUseCase';

interface DaemonSubListingRow {
    _id: string;
    row?: Record<string, unknown>;
    [key: string]: unknown;
}

interface DaemonPaginatedResult {
    data: DaemonSubListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

const EMPTY_RESULT = (subListingName: string): GetSubListingOutputDTO => ({
    subListingName,
    columns: [],
    rows: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
});

@injectable()
@AliasOf(PLUGIN_USECASE_TOKENS.GetSubListingUseCase)
export class GetSubListingUseCase implements IUseCase<GetSubListingInputDTO, GetSubListingOutputDTO>, IGetSubListingUseCase {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: GetSubListingInputDTO): Promise<GetSubListingOutputDTO> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await this.analysisRepository.findById(input.analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId(analysis.props)
            : undefined;
        if (!teamClusterId) {
            return EMPTY_RESULT(input.subListingName);
        }

        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            ChannelCommands.PluginSubListingsList,
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                timestep: Number(input.timestep),
                subListingName: input.subListingName,
                page,
                limit
            }
        );

        const daemonRows = daemonResult.data || [];

        const rows = daemonRows.map((doc) => ({
            _id: doc._id || '',
            ...((doc.row && typeof doc.row === 'object') ? doc.row : {})
        }));

        let columns: SubListingColumn[] = [];
        if (daemonRows.length > 0) {
            const firstRow = daemonRows[0].row;
            if (firstRow && typeof firstRow === 'object') {
                columns = Object.keys(firstRow).map((key) => ({
                    label: key,
                    sortable: true
                }));
            }
        }

        return {
            subListingName: input.subListingName,
            columns,
            rows,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        };
    }
}
