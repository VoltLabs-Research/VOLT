import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import ClusterObjectArchiveService, { type ClusterArchiveReference } from '@modules/cluster/infrastructure/services/ClusterObjectArchiveService';
import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import {
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/DownloadTrajectoryAnalysesDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { injectable } from 'tsyringe';
import { v4 } from 'uuid';

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

        
        private readonly getPluginExposureExportUseCase: GetPluginExposureExportUseCase,

        
        private readonly archiveService: ClusterObjectArchiveService
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
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            return Result.fail(ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            ));
        }

        const archiveEntries = [];
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

            const clusterObject = this.readClusterObjectReference(exportArtifact);
            exportArtifact.stream.destroy();
            if (!clusterObject) {
                continue;
            }

            const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
                || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
                || `AnalysisID-${analysis._id}.zip`;

            archiveEntries.push({
                type: 'object' as const,
                ownerClusterId: clusterObject.teamClusterId,
                bucket: clusterObject.bucket,
                objectKey: clusterObject.objectKey,
                name: filename
            });
        }

        if (archiveEntries.length === 0) {
            return Result.fail(ApplicationError.conflict(
                'Trajectory::Analyses::NoTimestepArtifacts',
                'No completed analysis artifacts are available to download for this trajectory'
            ));
        }

        return Result.ok(await this.archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-analyses/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-analyses.zip`,
            entries: archiveEntries
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

    private readClusterObjectReference(output: DownloadStreamOutputDTO): ClusterArchiveReference | null {
        const candidate = output as DownloadStreamOutputDTO & {
            clusterObject?: ClusterArchiveReference;
        };

        return candidate.clusterObject ?? null;
    }
}
