
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';

import {
    enrichDaemonListingRows
} from '@modules/plugin/services/listing-row/ListingRowEnrichmentService';
import { type DaemonListingRow, type DaemonPaginatedResult } from '@modules/plugin/services/listing-row/DaemonListingMapper';
import {
    type SummarizeAnalysisResultInput,
    type SummarizeAnalysisResultOutput,
    type ColumnStats,
    type SummarizedColumn,
    type SummarizedExposure
} from '@modules/plugin/services/listing-row/ListingRowTypes';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

import { DAEMON_PAGE_SIZE } from '@modules/plugin/services/plugin/listing-constants';
const DEFAULT_MAX_ROWS = 50_000;
const HARD_MAX_ROWS = 200_000;
const TOP_VALUES_LIMIT = 5;

interface ExposureAccumulator {
    exposureId: string;
    exposureName: string;
    rowCount: number;
    columnValues: Map<string, unknown[]>;
}

export default class AnalysisResultSummarizer{
    #daemonClient = teamClusterDaemonClient;

    async summarizeAnalysisResult(input: SummarizeAnalysisResultInput): Promise<SummarizeAnalysisResultOutput> {
        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            );
        }

        const status = analysis.status || 'pending';
        const pluginDisplayName = analysis.pluginDisplayName || analysis.plugin;
        const teamClusterId = analysis.computeClusterId ?? undefined;

        if (!teamClusterId) {
            return this.#summarizeEmptyResult(input.analysisId, pluginDisplayName, status,
                'No results are available yet — the analysis has not produced queryable output (it may still be pending or running).');
        }

        const { rows, truncated, maxRows } = await this.#summarizeCollectRows(teamClusterId, input.analysisId, input.maxRows);

        const enriched = await enrichDaemonListingRows({
            rows,
            fallbackAnalysisId: input.analysisId
        });

        const trajectoryName = enriched.find((row) => row.trajectoryName)?.trajectoryName
            || (await this.#summarizeResolveTrajectoryName(analysis.trajectory));

        const filtered = input.exposureId
            ? enriched.filter((row) => row.exposureId === input.exposureId)
            : enriched;

        if (filtered.length === 0) {
            return {
                ...this.#summarizeEmptyResult(input.analysisId, pluginDisplayName, status,
                    status === 'completed'
                        ? 'The analysis completed but returned no tabular result rows for the requested exposure.'
                        : `The analysis is "${status}" and has not produced result rows yet.`),
                trajectoryName
            };
        }

        const exposures = this.#summarizeExposures(filtered);
        const note = truncated
            ? `Statistics computed from the first ${maxRows.toLocaleString('en-US')} rows (result set is larger; sample is truncated).`
            : undefined;

        return {
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
        };
    }

    #summarizeEmptyResult(
        analysisId: string,
        pluginDisplayName: string,
        status: string,
        note: string
    ): SummarizeAnalysisResultOutput {
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

    async #summarizeResolveTrajectoryName(trajectoryId?: string): Promise<string> {
        if (!trajectoryId) {
            return '';
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: trajectoryId });
        return trajectory?.name?.trim() || '';
    }

    async #summarizeCollectRows(
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
            const daemonResult = await this.#daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                {
                    analysisId,
                    page,
                    limit: DAEMON_PAGE_SIZE
                }
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

        return {
            rows,
            truncated,
            maxRows
        };
    }

    #summarizeExposures(rows: DaemonListingRow[]): SummarizedExposure[] {
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

            for (const [column, value] of Object.entries(row.row ?? {})) {
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
                columns: this.#summarizeColumns(accumulator.columnValues)
            }));
    }

    #summarizeColumns(columnValues: Map<string, unknown[]>): SummarizedColumn[] {
        return Array.from(columnValues.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, values]) => ({
                name,
                stats: this.#summarizeComputeColumnStats(values)
            }));
    }

    #summarizeComputeColumnStats(values: unknown[]): ColumnStats {
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
                mean: this.#summarizeRound(mean),
                stddev: this.#summarizeRound(stddev)
            };
        }

        const frequencies = new Map<string, number>();
        for (const value of nonNull) {
            const key = this.#summarizeStringifyValue(value);
            frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
        }

        const topValues = Array.from(frequencies.entries())
            .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
            .slice(0, TOP_VALUES_LIMIT)
            .map(([value, count]) => ({
                value,
                count
            }));

        return {
            kind: 'categorical',
            count: nonNull.length,
            nullCount,
            distinctCount: frequencies.size,
            topValues
        };
    }

    #summarizeStringifyValue(value: unknown): string {
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

    #summarizeRound(value: number): number {
        return Math.round(value * 1e6) / 1e6;
    }
}
