import { CLUSTER_ACCESS_TOKENS, COMPUTE_TOKENS, PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens';
import { inject } from 'tsyringe';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import type { IClusterObjectArchiveService, ClusterArchiveReference, ClusterArchiveObjectEntry } from '@shared/contracts/ports';
import type { IGetPluginExposureExportUseCase } from '@shared/contracts/ports';
import {
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO
} from '@modules/trajectory/dtos/trajectory/DownloadTrajectoryAnalysesDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { injectable } from 'tsyringe';
import pLimit from 'p-limit';
import { v4 } from 'uuid';

import type { Analysis } from '@shared/contracts/types';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import type { IUseCase } from '@shared/application/IUseCase';

const ANALYSIS_STATUS_COMPLETED = 'completed';

const ANALYSIS_EXPORT_CONCURRENCY = 8;

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
    DownloadTrajectoryAnalysesOutputDTO
> {
    constructor(

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,


        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,


        @inject(PLUGIN_USECASE_TOKENS.GetPluginExposureExportUseCase)
        private readonly getPluginExposureExportUseCase: IGetPluginExposureExportUseCase,

        @inject(CLUSTER_ACCESS_TOKENS.ClusterObjectArchiveService)
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    async execute(
        input: DownloadTrajectoryAnalysesInputDTO
    ): Promise<DownloadTrajectoryAnalysesOutputDTO> {
        const trajectory = await this.trajectoryRepository.findById(input.trajectoryId);
        if (!trajectory || trajectory.props.team !== input.teamId) {
            throw ApplicationError.notFound(
                'Trajectory::NotFound',
                'Trajectory not found'
            );
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
            throw ApplicationError.conflict(
                'Trajectory::Analyses::NoCompletedExports',
                'No completed analyses are available to download for this trajectory'
            );
        }

        const filenameBase = sanitizeDownloadName(input.name || trajectory.props.name || input.trajectoryId, 'trajectory');
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            );
        }

        const limit = pLimit(ANALYSIS_EXPORT_CONCURRENCY);
        const archiveEntries = (await Promise.all(completedAnalyses.map((analysis) => {
            return limit(() => this.buildArchiveEntry(analysis, input.teamId));
        }))).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        if (archiveEntries.length === 0) {
            throw ApplicationError.conflict(
                'Trajectory::Analyses::NoTimestepArtifacts',
                'No completed analysis artifacts are available to download for this trajectory'
            );
        }

        return this.archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-analyses/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-analyses.zip`,
            entries: archiveEntries
        });
    }

    private async buildArchiveEntry(
        analysis: Analysis,
        teamId: string
    ): Promise<ClusterArchiveObjectEntry | null> {
        let exportArtifact: DownloadStreamOutputDTO;

        try {
            exportArtifact = await this.exportAnalysisArtifact({
                analysis,
                teamId
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return null;
            }

            throw error;
        }

        await exportArtifact.prepare?.();

        const clusterObject = this.readClusterObjectReference(exportArtifact);
        exportArtifact.stream.destroy();
        if (!clusterObject) {
            return null;
        }

        const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
            || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
            || `AnalysisID-${analysis._id}.zip`;

        return {
            type: 'object' as const,
            ownerClusterId: clusterObject.teamClusterId,
            bucket: clusterObject.bucket,
            objectKey: clusterObject.objectKey,
            name: filename
        };
    }

    private async exportAnalysisArtifact(input: {
        analysis: Analysis;
        teamId: string;
    }): Promise<DownloadStreamOutputDTO> {
        return this.getPluginExposureExportUseCase.execute({
            analysisId: input.analysis._id,
            teamId: input.teamId
        });
    }

    private readClusterObjectReference(output: DownloadStreamOutputDTO): ClusterArchiveReference | null {
        const candidate = output as DownloadStreamOutputDTO & {
            clusterObject?: ClusterArchiveReference;
        };

        return candidate.clusterObject ?? null;
    }
}
