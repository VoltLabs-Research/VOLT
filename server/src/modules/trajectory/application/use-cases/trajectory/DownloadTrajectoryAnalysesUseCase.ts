import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import {
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryAnalysesDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { createZipDownloadResponse, sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { injectable } from 'tsyringe';

import type Analysis from '@modules/analysis/domain/entities/Analysis';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';

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
        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly analysisRepository: AnalysisRepository,

        
        private readonly getPluginExposureExportUseCase: GetPluginExposureExportUseCase
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
                let appendedCount = 0;

                for (const analysis of completedAnalyses) {
                    let exportArtifact: DownloadStreamOutputDTO;

                    try {
                        exportArtifact = await this.exportAnalysisArtifact({
                            analysis,
                            teamId: input.teamId
                        });
                    } catch (error: unknown) {
                        if (error instanceof ApplicationError && error.statusCode === 404) {
                            continue;
                        }

                        throw error;
                    }

                    await exportArtifact.prepare?.();

                    const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
                        || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
                        || `AnalysisID-${analysis._id}.zip`;

                    archive.append(exportArtifact.stream, {
                        name: filename
                    });
                    appendedCount += 1;
                }

                if (appendedCount === 0) {
                    throw ApplicationError.conflict(
                        'Trajectory::Analyses::NoTimestepArtifacts',
                        'No completed analysis artifacts are available to download for this trajectory'
                    );
                }
            }
        }));
    }

    private async exportAnalysisArtifact(input: {
        analysis: Analysis;
        teamId: string;
    }): Promise<DownloadStreamOutputDTO> {
        const exportResult = await this.getPluginExposureExportUseCase.execute({
            analysisId: input.analysis._id,
            teamId: input.teamId
        });

        if (!exportResult.success) {
            throw exportResult.error;
        }

        return exportResult.value;
    }
}
