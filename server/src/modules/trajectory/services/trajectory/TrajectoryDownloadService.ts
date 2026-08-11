import { ErrorCodes } from '@core/constants/error-codes';
import { STATIC_ROOT } from '@core/config/paths';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import Trajectory from '@modules/trajectory/models/Trajectory';
import ClusterObjectArchiveService from '@modules/cluster/services/object-store/ClusterObjectArchiveService';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import PluginService from '@modules/plugin/services/PluginService';
import {
    ANALYSIS_LIST_MAX_LIMIT,
    findAnalyses
} from '@modules/trajectory/services/trajectory/TrajectoryQueries';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';

import ApplicationError from '@shared/application/errors/ApplicationError';
import {
    createDownloadStreamResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { readFilenameFromContentDisposition } from '@shared/infrastructure/http/responses/content-disposition';

import type { ClusterArchiveObjectEntry, ClusterArchiveReference } from '@shared/contracts/ports';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type {
    DownloadSampleSimulationsOutput,
    DownloadTrajectoryAnalysesInput,
    DownloadTrajectoryInput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

import pLimit from 'p-limit';
import { v4 } from 'uuid';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');
const ANALYSIS_STATUS_COMPLETED = 'completed';
const ANALYSIS_EXPORT_CONCURRENCY = 8;

const archiveService = new ClusterObjectArchiveService();
const pluginService = new PluginService();

/** Team scoping: a trajectory is only downloadable from the team that owns it. */
const requireTeamTrajectory = async (trajectoryId: string, teamId: string): Promise<Trajectory> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
    if (!trajectory || trajectory.team !== teamId) {
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    return trajectory;
};

/**
 * Resolves one analysis' exported bundle to a cluster object reference the
 * archive builder can pull directly, skipping analyses that never produced one.
 */
const buildAnalysisArchiveEntry = async (
    analysisId: string,
    teamId: string
): Promise<ClusterArchiveObjectEntry | null> => {
    let exportArtifact: DownloadStreamOutput;

    try {
        exportArtifact = await pluginService.getPluginExposureExport({
            analysisId,
            teamId
        });
    } catch (error: unknown) {
        if (error instanceof ApplicationError && error.statusCode === 404) {
            return null;
        }
        throw error;
    }

    await exportArtifact.prepare?.();

    const candidate = exportArtifact as DownloadStreamOutput & { clusterObject?: ClusterArchiveReference };
    const clusterObject = candidate.clusterObject;
    exportArtifact.stream.destroy();
    if (!clusterObject) {
        return null;
    }

    return {
        type: 'object' as const,
        ownerClusterId: clusterObject.teamClusterId,
        bucket: clusterObject.bucket,
        objectKey: clusterObject.objectKey,
        name: readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
            || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
            || `AnalysisID-${analysisId}.zip`
    };
};

class TrajectoryDownloadService {
    /** Single dump by default; `archive` bundles every timestep into one zip. */
    async downloadTrajectory(input: DownloadTrajectoryInput): Promise<DownloadStreamOutput> {
        const { trajectoryId } = input;
        const trajectory = await requireTeamTrajectory(trajectoryId, input.teamId);

        const timesteps = await trajectoryDumpStorageService.listDumps(trajectoryId);
        if (timesteps.length === 0) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND, 'No dump data available for this trajectory');
        }

        const storageClusterId = trajectory.storageClusterId;
        const filenameBase = sanitizeDownloadName(input.name || trajectory.name || trajectoryId, 'trajectory');

        if (input.archive) {
            return archiveService.createArchiveDownload({
                teamClusterId: storageClusterId,
                outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
                outputObjectKey: `exports/trajectory-downloads/${trajectoryId}/${v4()}.zip`,
                filename: `${filenameBase}-dumps.zip`,
                cacheControl: 'no-cache',
                entries: timesteps.map((timestep) => {
                    const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);
                    return {
                        type: 'object' as const,
                        ownerClusterId: storageClusterId,
                        bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                        objectKey: objectName,
                        name: objectName.split('/').pop() || objectName
                    };
                })
            });
        }

        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timesteps[0]);
        const response = await objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);

        return createDownloadStreamResponse({
            stream: response.stream,
            contentType: response.contentType || 'application/octet-stream',
            filename: objectName.split('/').pop() || `${filenameBase}.dump.zst`,
            cacheControl: 'no-cache'
        });
    }

    /** Bundles every completed analysis export for one trajectory. */
    async downloadTrajectoryAnalyses(input: DownloadTrajectoryAnalysesInput): Promise<DownloadStreamOutput> {
        const trajectory = await requireTeamTrajectory(input.trajectoryId, input.teamId);

        const analyses = await findAnalyses({
            where: {
                trajectory: input.trajectoryId,
                team: input.teamId
            },
            order: { createdAt: 'DESC' },
            limit: ANALYSIS_LIST_MAX_LIMIT
        });

        const completedAnalyses = analyses.data.filter((analysis) => (
            analysis.status.toLowerCase() === ANALYSIS_STATUS_COMPLETED
        ));

        if (completedAnalyses.length === 0) {
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_ANALYSES_NO_COMPLETED_EXPORTS,
                'No completed analyses are available to download for this trajectory'
            );
        }

        const limit = pLimit(ANALYSIS_EXPORT_CONCURRENCY);
        const archiveEntries = (await Promise.all(completedAnalyses.map((analysis) => (
            limit(() => buildAnalysisArchiveEntry(analysis.id, input.teamId))
        )))).filter((entry): entry is ClusterArchiveObjectEntry => entry !== null);

        if (archiveEntries.length === 0) {
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_ANALYSES_NO_TIMESTEP_ARTIFACTS,
                'No completed analysis artifacts are available to download for this trajectory'
            );
        }

        const filenameBase = sanitizeDownloadName(input.name || trajectory.name || input.trajectoryId, 'trajectory');

        return archiveService.createArchiveDownload({
            teamClusterId: trajectory.storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-analyses/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-analyses.zip`,
            entries: archiveEntries
        });
    }

    async listSamples(): Promise<string[]> {
        try {
            await fs.access(SAMPLES_PATH);
        } catch {
            throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample simulations not found', 404);
        }

        const entries = await fs.readdir(SAMPLES_PATH);
        return entries.filter((entry) => entry.endsWith('.zip'));
    }

    /**
     * Reads a bundled sample off local disk. The name reaches the filesystem, so
     * it is reduced to a basename and required to be a zip.
     */
    async downloadSamples(input: { filename?: string }): Promise<DownloadSampleSimulationsOutput> {
        const filename = input.filename ? path.basename(input.filename) : '';
        if (!filename.endsWith('.zip')) {
            throw new ApplicationError(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid filename', 400);
        }

        const filePath = path.join(SAMPLES_PATH, filename);
        try {
            await fs.access(filePath);
        } catch {
            throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample not found', 404);
        }

        return {
            stream: createReadStream(filePath),
            filename
        };
    }
}

export default new TrajectoryDownloadService();
