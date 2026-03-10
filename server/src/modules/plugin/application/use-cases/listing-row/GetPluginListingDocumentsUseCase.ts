import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { toPluginListingOptions } from '@modules/plugin/utilities/listing-row/toPluginListingOptions';
import { IPluginListingService } from '@modules/plugin/domain/port/listing-row/IPluginListingService';
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

const buildDaemonMeta = (
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

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService)
        private readonly listingService: IPluginListingService,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const page = input.page ?? 1;
        const limit = input.limit ?? 50;

        if (input.analysisId) {
            const analysis = await this.analysisRepository.findById(input.analysisId);
            if (analysis?.props.teamCluster) {
                return this.executeFromDaemon(analysis.props.teamCluster, input, page, limit);
            }
        }

        const result = await this.listingService.getListingDocuments(
            input.pluginId,
            {
                ...toPluginListingOptions(input),
                page,
                limit
            }
        );

        return Result.ok(result);
    }

    private async executeFromDaemon(
        teamClusterId: string,
        input: GetPluginListingDocumentsInputDTO,
        page: number,
        limit: number
    ): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            'plugin.listings.list',
            {
                pluginId: input.pluginId,
                analysisId: input.analysisId,
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
            _meta: buildDaemonMeta(input.pluginId, daemonResult, input)
        });
    }
};
