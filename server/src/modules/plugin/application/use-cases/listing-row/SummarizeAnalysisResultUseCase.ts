import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { ITrajectoryRepository, IAnalysisRepository } from '@shared/contracts/ports';
import {
    ColumnStats,
    SummarizeAnalysisResultInputDTO,
    SummarizeAnalysisResultOutputDTO,
    SummarizedColumn,
    SummarizedExposure
} from '@modules/plugin/application/dtos/listing-row/SummarizeAnalysisResultDTO';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import { enrichDaemonListingRows } from '@modules/plugin/application/use-cases/listing-row/listing-row-enrichment';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject } from 'tsyringe';

const DAEMON_PAGE_SIZE = 200;
const DEFAULT_MAX_ROWS = 50_000;
const HARD_MAX_ROWS = 200_000;
const TOP_VALUES_LIMIT = 5;

interface ExposureAccumulator {
    exposureId: string;
    exposureName: string;
    rowCount: number;
    columnValues: Map<string, unknown[]>;
}

/**
 * Turns an analysis's parquet results into a compact statistical summary the
 * LLM can reason over, instead of handing it raw rows. Parquet is never read in
 * the server — the daemon reads it via DuckDB and returns JSON rows over the
 * reverse-websocket; this use case collects those rows (capped, with explicit
 * truncation reporting) and derives per-column statistics. Mirrors the
 * pagination pattern of {@link AnalysisListingExportCatalogService}.
 */
@Singleton()
export class SummarizeAnalysisResultUseCase implements IUseCase<SummarizeAnalysisResultInputDTO, SummarizeAnalysisResultOutputDTO, ApplicationError> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: SummarizeAnalysisResultInputDTO): Promise<Result<SummarizeAnalysisResultOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        const status = analysis.props.status || 'pending';
        const pluginDisplayName = analysis.props.pluginDisplayName || analysis.props.plugin;
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);

        // No reachable cluster means there are no queryable results yet (analysis
        // still pending/running, or its storage cluster is offline). Report that
        // plainly rather than failing — the assistant should say "not ready".
        if (!teamClusterId) {
            return Result.ok(this.emptyResult(input.analysisId, pluginDisplayName, status,
                'No results are available yet — the analysis has not produced queryable output (it may still be pending or running).'));
        }

        const { rows, truncated, maxRows } = await this.collectRows(teamClusterId, input.analysisId, input.maxRows);

        const enriched = await enrichDaemonListingRows({
            rows,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            fallbackAnalysisId: input.analysisId
        });

        const trajectoryName = enriched.find((row) => row.trajectoryName)?.trajectoryName
            || (await this.resolveTrajectoryName(analysis.props.trajectory));

        const filtered = input.exposureId
            ? enriched.filter((row) => row.exposureId === input.exposureId)
            : enriched;

        if (filtered.length === 0) {
            return Result.ok({
                ...this.emptyResult(input.analysisId, pluginDisplayName, status,
                    status === 'completed'
                        ? 'The analysis completed but returned no tabular result rows for the requested exposure.'
                        : `The analysis is "${status}" and has not produced result rows yet.`),
                trajectoryName
            });
        }

        const exposures = this.summarizeExposures(filtered);
        const note = truncated
            ? `Statistics computed from the first ${maxRows.toLocaleString('en-US')} rows (result set is larger; sample is truncated).`
            : undefined;

        return Result.ok({
            analysisId: input.analysisId,
            pluginDisplayName,
            trajectoryName,
            status,
            hasResults: true,
            rowCount: filtered.length,
            sampledRows: filtered.length,
            truncated,
            exposures,
            note
        });
    }

    private emptyResult(
        analysisId: string,
        pluginDisplayName: string,
        status: string,
        note: string
    ): SummarizeAnalysisResultOutputDTO {
        return {
            analysisId,
            pluginDisplayName,
            trajectoryName: '',
            status,
            hasResults: false,
            rowCount: 0,
            sampledRows: 0,
            truncated: false,
            exposures: [],
            note
        };
    }

    private async resolveTrajectoryName(trajectoryId?: string): Promise<string> {
        if (!trajectoryId) {
            return '';
        }

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        return trajectory?.props.name?.trim() || '';
    }

    private async collectRows(
        teamClusterId: string,
        analysisId: string,
        requestedMaxRows?: number
    ): Promise<{ rows: DaemonListingRow[]; truncated: boolean; maxRows: number }> {
        const maxRows = Math.min(
            HARD_MAX_ROWS,
            Math.max(1, Math.floor(requestedMaxRows ?? DEFAULT_MAX_ROWS))
        );

        const rows: DaemonListingRow[] = [];
        let page = 1;
        let totalPages = 1;
        let truncated = false;

        do {
            const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                { analysisId, page, limit: DAEMON_PAGE_SIZE }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);

            for (const row of daemonResult.data || []) {
                if (rows.length >= maxRows) {
                    truncated = true;
                    break;
                }
                rows.push(row);
            }

            if (truncated) {
                break;
            }

            page += 1;
        } while (page <= totalPages);

        return { rows, truncated, maxRows };
    }

    private summarizeExposures(rows: DaemonListingRow[]): SummarizedExposure[] {
        const accumulators = new Map<string, ExposureAccumulator>();

        for (const row of rows) {
            const exposureId = row.exposureId || 'exposure';
            const exposureName = row.exposureName || exposureId;
            const key = `${exposureId}::${exposureName}`;

            const accumulator = accumulators.get(key) ?? {
                exposureId,
                exposureName,
                rowCount: 0,
                columnValues: new Map<string, unknown[]>()
            };

            accumulator.rowCount += 1;

            const data = (row.row && typeof row.row === 'object' && !Array.isArray(row.row))
                ? row.row
                : {};

            for (const [column, value] of Object.entries(data)) {
                const values = accumulator.columnValues.get(column) ?? [];
                values.push(value);
                accumulator.columnValues.set(column, values);
            }

            accumulators.set(key, accumulator);
        }

        return Array.from(accumulators.values())
            .sort((left, right) => left.exposureName.localeCompare(right.exposureName))
            .map((accumulator) => ({
                exposureId: accumulator.exposureId,
                exposureName: accumulator.exposureName,
                rowCount: accumulator.rowCount,
                columns: this.summarizeColumns(accumulator.columnValues)
            }));
    }

    private summarizeColumns(columnValues: Map<string, unknown[]>): SummarizedColumn[] {
        return Array.from(columnValues.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, values]) => ({
                name,
                stats: this.computeColumnStats(values)
            }));
    }

    private computeColumnStats(values: unknown[]): ColumnStats {
        const nonNull = values.filter((value) => value !== null && value !== undefined);
        const nullCount = values.length - nonNull.length;

        const numeric = nonNull.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const isNumeric = nonNull.length > 0 && numeric.length === nonNull.length;

        if (isNumeric) {
            const count = numeric.length;
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;
            for (const value of numeric) {
                if (value < min) min = value;
                if (value > max) max = value;
                sum += value;
            }
            const mean = sum / count;
            const variance = numeric.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
            const stddev = Math.sqrt(variance);

            return {
                kind: 'numeric',
                count,
                nullCount,
                min,
                max,
                mean: this.round(mean),
                stddev: this.round(stddev)
            };
        }

        const frequencies = new Map<string, number>();
        for (const value of nonNull) {
            const key = this.stringifyValue(value);
            frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
        }

        const topValues = Array.from(frequencies.entries())
            .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
            .slice(0, TOP_VALUES_LIMIT)
            .map(([value, count]) => ({ value, count }));

        return {
            kind: 'categorical',
            count: nonNull.length,
            nullCount,
            distinctCount: frequencies.size,
            topValues
        };
    }

    private stringifyValue(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    private round(value: number): number {
        return Math.round(value * 1e6) / 1e6;
    }
}
