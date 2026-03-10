import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    ExportPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { createSerializedDownloadResponse } from '@shared/infrastructure/http/responses/download-response';
import { toPluginListingOptions } from '@modules/plugin/utilities/listing-row/toPluginListingOptions';
import { IPluginListingExportService } from '@modules/plugin/domain/port/listing-row/IPluginListingExportService';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { deriveColumns, mapDaemonRow } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { ListingRowData } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

const DAEMON_PAGE_SIZE = 200;

@injectable()
export class ExportPluginListingDocumentsUseCase implements IUseCase<
    ExportPluginListingDocumentsInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService)
        private readonly listingService: IPluginListingExportService,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<Result<DownloadStreamOutputDTO>> {
        if (input.analysisId) {
            const analysis = await this.analysisRepository.findById(input.analysisId);
            if (analysis?.props.teamCluster) {
                return this.executeFromDaemon(analysis.props.teamCluster, input);
            }
        }

        const payload: ExportPluginListingDocumentsOutputDTO = await this.listingService.exportListingDocuments(
            input.pluginId,
            {
                ...toPluginListingOptions(input),
                format: input.format ?? ExportType.Json
            }
        );

        const orderedColumns = [
            '_id',
            'timestep',
            'analysisId',
            'trajectoryId',
            'exposureId',
            'trajectoryName',
            ...payload.meta.columns.map((column) => column.label)
        ];

        const columns = Array.from(new Set(orderedColumns));

        return Result.ok(createSerializedDownloadResponse({
            filename: `${payload.meta.pluginId}_${payload.meta.exposureId}_listing`,
            format: payload.meta.format,
            rows: payload.data,
            columns
        }));
    }

    private async executeFromDaemon(
        teamClusterId: string,
        input: ExportPluginListingDocumentsInputDTO
    ): Promise<Result<DownloadStreamOutputDTO>> {
        const format = input.format ?? ExportType.Json;
        const allRows: DaemonListingRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                'plugin.listings.list',
                {
                    pluginId: input.pluginId,
                    analysisId: input.analysisId,
                    trajectoryId: input.trajectoryId,
                    exposureId: input.exposureId,
                    exposureName: input.exposureName,
                    page: currentPage,
                    limit: DAEMON_PAGE_SIZE
                }
            );

            allRows.push(...(result.data || []));
            totalPages = result.totalPages || 1;
            currentPage++;
        } while (currentPage <= totalPages);

        const data: ListingRowData[] = allRows.map(mapDaemonRow);
        const derivedColumns = deriveColumns(allRows);

        const orderedColumns = [
            '_id',
            'timestep',
            'analysisId',
            'trajectoryId',
            'exposureId',
            'trajectoryName',
            ...derivedColumns.map((column) => column.label)
        ];

        const columns = Array.from(new Set(orderedColumns));
        const exposureId = input.exposureId || allRows[0]?.exposureId || '';

        return Result.ok(createSerializedDownloadResponse({
            filename: `${input.pluginId}_${exposureId}_listing`,
            format,
            rows: data,
            columns
        }));
    }
};
