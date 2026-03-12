import {
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { resolveListingPagination } from '@modules/plugin/application/use-cases/listing-row/listing-row-pagination';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

import { deriveColumns, mapDaemonRow } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

import type { PluginListingDocumentsMeta } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

const buildMeta = (
    pluginId: string,
    daemonResult: DaemonPaginatedResult,
    input: GetPluginListingDocumentsInputDTO
): PluginListingDocumentsMeta => {
    const rows = daemonResult.data || [];
    const firstRow = rows[0];

    const columns = daemonResult.columns
        ? daemonResult.columns.map((label) => ({ label, sortable: true }))
        : deriveColumns(rows);

    const subListingNames = daemonResult.subListingNames ?? firstRow?.subListingNames ?? [];

    return {
        pluginId,
        exposureName: input.exposureName || firstRow?.exposureName || '',
        exposureId: input.exposureId || firstRow?.exposureId || '',
        columns,
        subListingNames
    };
};

const EMPTY_RESULT: GetPluginListingDocumentsOutputDTO = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0,
    _meta: { pluginId: '', exposureName: '', exposureId: '', columns: [], subListingNames: [] }
};

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const { page, limit } = resolveListingPagination(input);

        const resolved = await this.resolveTeamCluster(input);
        if (!resolved) {
            return Result.ok(EMPTY_RESULT);
        }

        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            resolved.teamClusterId,
            'plugin.listings.list',
            {
                pluginId: input.pluginId,
                teamId: input.teamId,
                analysisId: resolved.analysisId,
                trajectoryId: input.trajectoryId,
                exposureId: input.exposureId,
                exposureName: input.exposureName,
                page,
                limit
            }
        );

        const data = (daemonResult.data || []).map(mapDaemonRow);

        return Result.ok({
            data,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit,
            _meta: buildMeta(input.pluginId, daemonResult, input)
        });
    }

    private async resolveTeamCluster(
        input: GetPluginListingDocumentsInputDTO
    ): Promise<{ teamClusterId: string; analysisId: string } | null> {
        if (input.analysisId) {
            const analysis = await this.analysisRepository.findById(input.analysisId);
            if (!analysis?.props.teamCluster) {
                return null;
            }

            return { teamClusterId: analysis.props.teamCluster, analysisId: input.analysisId };
        }

        const filter: Record<string, unknown> = {
            plugin: input.pluginId,
            teamCluster: { $exists: true, $ne: null }
        };
        if (input.trajectoryId) filter.trajectory = input.trajectoryId;
        if (input.teamId) filter.team = input.teamId;

        const analysis = await this.analysisRepository.findOne(filter);
        if (analysis?.props.teamCluster) {
            return { teamClusterId: analysis.props.teamCluster, analysisId: analysis._id };
        }

        return null;
    }
};
