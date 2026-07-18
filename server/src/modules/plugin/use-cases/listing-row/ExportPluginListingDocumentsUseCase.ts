import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { inject } from 'tsyringe';
import type { ITrajectoryRepository, IAnalysisRepository } from '@shared/contracts/ports';
import {
    ExportPluginListingDocumentsInputDTO
} from '@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO';
import { buildListingExportColumns, enrichDaemonListingRows } from '@modules/plugin/use-cases/listing-row/listing-row-enrichment';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { toCsvContent } from '@shared/infrastructure/http/responses/ExportFileResponse';
import { Readable } from 'node:stream';

import { mapDaemonRow } from '@modules/plugin/dtos/listing-row/DaemonListingTypes';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';

import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/dtos/listing-row/DaemonListingTypes';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

const DAEMON_PAGE_SIZE = 200;

/**
 * Serializes enriched listing rows incrementally so the full dataset is never
 * materialized as a single string and the event loop can breathe between
 * batches. CSV reuses `toCsvContent` per batch (slicing off the repeated
 * BOM/header prefix) so the streamed bytes are identical to a single
 * `toCsvContent(allRows, columns)` call; JSON emits a compact array, matching
 * `JSON.stringify(rows)` element-for-element.
 */
function* serializeListingRows(
    format: ExportType,
    rows: DaemonListingRow[],
    columns: string[]
): Generator<string> {
    if (format === ExportType.Csv) {
        const header = toCsvContent([], columns);
        yield header;
        for (let offset = 0; offset < rows.length; offset += DAEMON_PAGE_SIZE) {
            const batch = rows.slice(offset, offset + DAEMON_PAGE_SIZE).map(mapDaemonRow);
            const chunk = toCsvContent(batch, columns).slice(header.length);
            if (chunk) {
                yield chunk;
            }
        }
        return;
    }

    yield '[';
    for (let index = 0; index < rows.length; index++) {
        yield `${index === 0 ? '' : ','}${JSON.stringify(mapDaemonRow(rows[index]))}`;
    }
    yield ']';
}

const createListingDownloadResponse = ({
    filename,
    format,
    rows,
    columns
}: {
    filename: string;
    format: ExportType;
    rows: DaemonListingRow[];
    columns: string[];
}) => {
    const isCsv = format === ExportType.Csv;
    const extension = isCsv ? 'csv' : 'json';
    const contentType = isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

    return createDownloadStreamResponse({
        stream: Readable.from(serializeListingRows(format, rows, columns)),
        contentType,
        filename: `${filename}.${extension}`
    });
};

@Singleton()
export class ExportPluginListingDocumentsUseCase implements IUseCase<
    ExportPluginListingDocumentsInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<DownloadStreamOutputDTO> {
        const format = input.format ?? ExportType.Json;

        const resolved = await this.resolveTeamCluster(input);
        if (!resolved) {
            return createListingDownloadResponse({
                filename: `${input.pluginId}_${input.exposureId || 'unknown'}_listing`,
                format,
                rows: [],
                columns: []
            });
        }

        const allRows: DaemonListingRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                resolved.teamClusterId,
                ChannelCommands.PluginListingsList,
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
        const columns = buildListingExportColumns(rows);
        const exposureId = input.exposureId || rows[0]?.exposureId || '';

        return createListingDownloadResponse({
            filename: `${input.pluginId}_${exposureId}_listing`,
            format,
            rows,
            columns
        });
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
}
