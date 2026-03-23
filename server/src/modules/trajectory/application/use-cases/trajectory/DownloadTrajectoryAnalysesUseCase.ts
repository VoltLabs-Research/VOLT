import {
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryAnalysesDTO';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    ExportListingRowsByAnalysisIdInputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { createZipDownloadResponse, sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { inject, injectable } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

const ANALYSIS_STATUS_COMPLETED = 'completed';

const readFilenameFromContentDisposition = (value: string | undefined): string | undefined => {
    if (!value) {
        return undefined;
    }

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const quotedMatch = value.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }

    const bareMatch = value.match(/filename=([^;]+)/i);
    return bareMatch?.[1]?.trim();
};

@injectable()
export default class DownloadTrajectoryAnalysesUseCase implements IUseCase<
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(ExportListingRowsByAnalysisIdUseCase)
        private readonly exportListingRowsByAnalysisIdUseCase: ExportListingRowsByAnalysisIdUseCase
    ) {}

    async execute(
        input: DownloadTrajectoryAnalysesInputDTO
    ): Promise<Result<DownloadTrajectoryAnalysesOutputDTO, ApplicationError>> {
        const trajectory = await this.trajectoryRepository.findById(input.trajectoryId);
        if (!trajectory || trajectory.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'Trajectory::NotFound',
                'Trajectory not found'
            ));
        }

        const analyses = await this.analysisRepository.findAll({
            filter: {
                trajectory: input.trajectoryId,
                team: input.teamId
            },
            sort: {
                createdAt: -1
            },
            limit: 1000
        });

        const completedAnalyses = analyses.data.filter((analysis) => {
            return String(analysis.props.status || '').toLowerCase() === ANALYSIS_STATUS_COMPLETED;
        });

        if (completedAnalyses.length === 0) {
            return Result.fail(ApplicationError.conflict(
                'Trajectory::Analyses::NoCompletedExports',
                'No completed analyses are available to download for this trajectory'
            ));
        }

        const filenameBase = sanitizeDownloadName(input.name || trajectory.props.name || input.trajectoryId, 'trajectory');

        return Result.ok(createZipDownloadResponse({
            filename: `${filenameBase}-analyses`,
            appendEntries: async (archive) => {
                for (const analysis of completedAnalyses) {
                    const exportArtifact = await this.exportAnalysisArtifact({
                        analysis,
                        teamId: input.teamId
                    });

                    await exportArtifact.prepare?.();

                    const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
                        || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
                        || `AnalysisID-${analysis._id}.zip`;

                    archive.append(exportArtifact.stream, {
                        name: filename
                    });
                }
            }
        }));
    }

    private async exportAnalysisArtifact(input: {
        analysis: Analysis;
        teamId: string;
    }): Promise<DownloadStreamOutputDTO> {
        const exportResult = await this.exportListingRowsByAnalysisIdUseCase.execute({
            analysisId: input.analysis._id,
            teamId: input.teamId,
            format: ExportType.Csv
        } satisfies ExportListingRowsByAnalysisIdInputDTO);

        if (!exportResult.success) {
            throw exportResult.error;
        }

        return exportResult.value;
    }
}
