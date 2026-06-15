import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import type {
    GetGlobalAttributesTimeSeriesInputDTO,
    GetGlobalAttributesTimeSeriesOutputDTO
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

@injectable()
export class GetGlobalAttributesTimeSeriesUseCase implements IUseCase<
    GetGlobalAttributesTimeSeriesInputDTO,
    GetGlobalAttributesTimeSeriesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: GetGlobalAttributesTimeSeriesInputDTO): Promise<Result<GetGlobalAttributesTimeSeriesOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis || String(analysis.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found'));
        }

        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        if (!teamClusterId) {
            return Result.ok({ attribute: input.attribute, frames: [], values: [] });
        }

        const rows = await this.collectAllRows(teamClusterId, input.analysisId);
        const summaryRows = rows.filter((r) => isSummaryExposure(r.exposureName || ''));

        const points: { frame: number; value: number }[] = [];
        for (const row of summaryRows) {
            const frame = row.timestep ?? 0;
            const frameStart = input.frameStart;
            const frameEnd = input.frameEnd;
            if (typeof frameStart === 'number' && frame < frameStart) continue;
            if (typeof frameEnd === 'number' && frame > frameEnd) continue;

            const data = (row.row && typeof row.row === 'object' && !Array.isArray(row.row))
                ? row.row
                : row;

            const value = data[input.attribute as keyof typeof data];
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            points.push({ frame, value: value as number });
        }

        points.sort((a, b) => a.frame - b.frame);

        return Result.ok({
            attribute: input.attribute,
            frames: points.map((p) => p.frame),
            values: points.map((p) => p.value)
        });
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
