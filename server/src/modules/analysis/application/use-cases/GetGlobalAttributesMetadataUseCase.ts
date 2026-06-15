import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import type {
    GetGlobalAttributesMetadataInputDTO,
    GetGlobalAttributesMetadataOutputDTO,
    GlobalAttributesMetadataItem
} from '@modules/analysis/application/dtos/GlobalAttributesDTO';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

const SUMMARY_EXPOSURE_PATTERNS = ['_summary', 'summary'];

const isSummaryExposure = (exposureName: string): boolean =>
    SUMMARY_EXPOSURE_PATTERNS.some((p) => exposureName.toLowerCase().includes(p));

const extractNumericColumns = (rows: DaemonListingRow[]): Map<string, number[]> => {
    const columns = new Map<string, number[]>();
    for (const row of rows) {
        const data = (row.row && typeof row.row === 'object' && !Array.isArray(row.row))
            ? row.row
            : row;
        for (const [key, value] of Object.entries(data)) {
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            if (!columns.has(key)) columns.set(key, []);
            columns.get(key)!.push(value);
        }
    }
    return columns;
};

@injectable()
export class GetGlobalAttributesMetadataUseCase implements IUseCase<
    GetGlobalAttributesMetadataInputDTO,
    GetGlobalAttributesMetadataOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: GetGlobalAttributesMetadataInputDTO): Promise<Result<GetGlobalAttributesMetadataOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis || String(analysis.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found'));
        }

        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        if (!teamClusterId) {
            return Result.ok({ attributes: [] });
        }

        // Collect all listing rows from daemon — summary parquets have per-frame rows
        const rows = await this.collectAllRows(teamClusterId, input.analysisId);
        const summaryRows = rows.filter((r) => isSummaryExposure(r.exposureName || ''));

        if (summaryRows.length === 0) {
            return Result.ok({ attributes: [] });
        }

        // Group by exposureName to derive metadata per attribute
        const byExposure = new Map<string, { pluginKey: string; rows: DaemonListingRow[] }>();
        for (const row of summaryRows) {
            const key = row.exposureName || 'summary';
            if (!byExposure.has(key)) {
                byExposure.set(key, { pluginKey: String(row.plugin || ''), rows: [] });
            }
            byExposure.get(key)!.rows.push(row);
        }

        const attributes: GlobalAttributesMetadataItem[] = [];
        for (const [exposureName, { pluginKey, rows: expRows }] of byExposure) {
            const columns = extractNumericColumns(expRows);
            for (const [colName, values] of columns) {
                const count = values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);
                const mean = values.reduce((s, v) => s + v, 0) / count;
                attributes.push({ name: colName, pluginKey, exposureName, min, max, mean, count });
            }
        }

        return Result.ok({ attributes });
    }

    private async collectAllRows(teamClusterId: string, analysisId: string): Promise<DaemonListingRow[]> {
        const rows: DaemonListingRow[] = [];
        let page = 1;
        let totalPages = 1;
        const limit = 500;

        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                { analysisId, page, limit }
            );
            rows.push(...(result.data || []));
            totalPages = result.totalPages || 1;
            page += 1;
        } while (page <= totalPages && rows.length < 10_000);

        return rows;
    }
}
