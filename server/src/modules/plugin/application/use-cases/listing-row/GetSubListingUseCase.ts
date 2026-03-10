import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable, inject } from 'tsyringe';

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

@injectable()
export class GetSubListingUseCase implements IUseCase<GetSubListingInputDTO, GetSubListingOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.SubListingRowRepository)
        private subListingRowRepository: ISubListingRowRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepository: IAnalysisRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private daemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: GetSubListingInputDTO): Promise<Result<GetSubListingOutputDTO>> {
        const page = Math.max(1, Number(input.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));

        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (analysis?.props.teamCluster) {
            return this.executeFromDaemon(analysis.props.teamCluster, input, page, limit);
        }

        const result = await this.subListingRowRepository.findAll({
            filter: {
                analysis: input.analysisId,
                exposureId: input.exposureId,
                timestep: Number(input.timestep),
                subListingName: input.subListingName
            },
            page,
            limit,
            sort: {
                _id: 1
            }
        });

        const rows = result.data.map((document) => ({
            _id: document._id,
            ...(document.props.row || {})
        }));

        let columns: SubListingColumn[] = [];
        if (result.data.length > 0) {
            columns = Object.keys(result.data[0].props.row || {}).map((key) => ({
                label: key,
                sortable: true
            }));
        }

        return Result.ok({
            subListingName: input.subListingName,
            columns,
            rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit
        });
    }

    private async executeFromDaemon(
        teamClusterId: string,
        input: GetSubListingInputDTO,
        page: number,
        limit: number
    ): Promise<Result<GetSubListingOutputDTO>> {
        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            'plugin.sub-listings.list',
            {
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
