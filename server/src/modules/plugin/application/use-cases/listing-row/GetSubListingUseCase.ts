import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';
import { resolveListingPagination } from '@modules/plugin/application/use-cases/listing-row/listing-row-pagination';
import { resolveAnalysisComputeClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable } from 'tsyringe';

interface DaemonSubListingRow {
    _id: string;
    row?: Record<string, unknown>;
    [key: string]: unknown;
};

interface DaemonPaginatedResult {
    data: DaemonSubListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

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
export class GetSubListingUseCase implements IUseCase<GetSubListingInputDTO, GetSubListingOutputDTO> {
    constructor(
        
        private analysisRepository: AnalysisRepository,

        
        private daemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: GetSubListingInputDTO): Promise<Result<GetSubListingOutputDTO>> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await this.analysisRepository.findById(input.analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId(analysis.props)
            : undefined;
        if (!teamClusterId) {
            return Result.ok(EMPTY_RESULT(input.subListingName));
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

        return Result.ok({
            subListingName: input.subListingName,
            columns,
            rows,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        });
    }
};
