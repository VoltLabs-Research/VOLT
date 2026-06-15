import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import type { ExportGlobalAttributesInputDTO } from '@modules/analysis/application/dtos/GlobalAttributesDTO';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import { Readable } from 'stream';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

export interface ExportGlobalAttributesOutputDTO {
    stream: Readable;
    contentType: string;
    filename: string;
}

const SUMMARY_EXPOSURE_PATTERNS = ['_summary', 'summary'];
const isSummaryExposure = (name: string) =>
    SUMMARY_EXPOSURE_PATTERNS.some((p) => name.toLowerCase().includes(p));

const CSV_HEADER = 'frame,attribute_name,value,plugin_key\n';

const rowsToCsvStream = (rows: DaemonListingRow[]): Readable => {
    const lines: string[] = [CSV_HEADER];

    for (const row of rows.filter((r) => isSummaryExposure(r.exposureName || ''))) {
        const frame = row.timestep ?? 0;
        const pluginKey = String(row.plugin || '');
        const data = (row.row && typeof row.row === 'object' && !Array.isArray(row.row))
            ? row.row
            : {};
        for (const [col, value] of Object.entries(data)) {
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            lines.push(`${frame},${col},${value},${pluginKey}\n`);
        }
    }

    return Readable.from(lines);
};

@injectable()
export class ExportGlobalAttributesUseCase implements IUseCase<
    ExportGlobalAttributesInputDTO,
    ExportGlobalAttributesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: ExportGlobalAttributesInputDTO): Promise<Result<ExportGlobalAttributesOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis || String(analysis.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound('ANALYSIS_NOT_FOUND', 'Analysis not found'));
        }

        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        if (!teamClusterId) {
            return Result.ok({
                stream: Readable.from([CSV_HEADER]),
                contentType: 'text/csv',
                filename: `global-attributes-${input.analysisId}.csv`
            });
        }

        const rows: DaemonListingRow[] = [];
        let page = 1;
        let totalPages = 1;
        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                { analysisId: input.analysisId, page, limit: 500 }
            );
            rows.push(...(result.data || []));
            totalPages = result.totalPages || 1;
            page += 1;
        } while (page <= totalPages && rows.length < 50_000);

        return Result.ok({
            stream: rowsToCsvStream(rows),
            contentType: 'text/csv',
            filename: `global-attributes-${input.analysisId}.csv`
        });
    }
}
