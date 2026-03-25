import {
    ExportPluginListingDocumentsInputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { resolveAnalysisComputeClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { buildListingExportColumns, enrichDaemonListingRows } from '@modules/plugin/application/use-cases/listing-row/listing-row-enrichment';
import { createSerializedDownloadResponse } from '@shared/infrastructure/http/responses/download-response';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';

import { mapDaemonRow } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { ListingRowData } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

const DAEMON_PAGE_SIZE = 200;

@injectable()
export class ExportPluginListingDocumentsUseCase implements IUseCase<
    ExportPluginListingDocumentsInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<Result<DownloadStreamOutputDTO>> {
        const format = input.format ?? ExportType.Json;

        const resolved = await this.resolveTeamCluster(input);
        if (!resolved) {
            return Result.ok(createSerializedDownloadResponse({
                filename: `${input.pluginId}_${input.exposureId || 'unknown'}_listing`,
                format,
                rows: [],
                columns: []
            }));
        }

        const allRows: DaemonListingRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                resolved.teamClusterId,
                'plugin.listings.list',
                {
                    pluginId: input.pluginId,
                    teamId: input.teamId,
                    analysisId: resolved.analysisId,
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

        const rows = await enrichDaemonListingRows({
            rows: allRows,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            fallbackAnalysisId: resolved.analysisId
        });
        const data: ListingRowData[] = rows.map(mapDaemonRow);
        const columns = buildListingExportColumns(rows);
        const exposureId = input.exposureId || rows[0]?.exposureId || '';

        return Result.ok(createSerializedDownloadResponse({
            filename: `${input.pluginId}_${exposureId}_listing`,
            format,
            rows: data,
            columns
        }));
    }

    private async resolveTeamCluster(
        input: ExportPluginListingDocumentsInputDTO
    ): Promise<{ teamClusterId: string; analysisId: string } | null> {
        if (input.analysisId) {
            const analysis = await this.analysisRepository.findById(input.analysisId);
            const teamClusterId = analysis
                ? resolveAnalysisComputeClusterId(analysis.props)
                : undefined;
            if (teamClusterId) {
                return { teamClusterId, analysisId: input.analysisId };
            }
        }

        const filter: Record<string, unknown> = {
            plugin: input.pluginId,
            computeClusterId: { $exists: true, $ne: null }
        };
        if (input.trajectoryId) filter.trajectory = input.trajectoryId;
        if (input.teamId) filter.team = input.teamId;

        const analysis = await this.analysisRepository.findOne(filter);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId(analysis.props)
            : undefined;
        if (analysis && teamClusterId) {
            return { teamClusterId, analysisId: analysis._id };
        }

        return null;
    }
};
