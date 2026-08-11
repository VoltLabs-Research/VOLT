import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import type { AnalysisStatusChangedEventPayload } from '@shared/contracts/events';
import type { Analysis, JobStatus } from '@shared/contracts/types';
import logger from '@shared/infrastructure/logger';
import type { JobTrajectoryContext } from '@modules/cluster/services/daemon/DaemonJobOwnershipResolver';

const JOB_STATUS_PUBLISH_BATCH_SIZE = 50;
const PROJECTED_JOB_SOURCE = 'projected';
const PROJECTED_JOB_BACKING_SOURCE = 'daemon';

/**
 * Queue type + job-cleanup scope always travel together, so they are declared
 * as a single pair per daemon job family instead of eight loose constants.
 */
export const PROJECTED_JOB_KINDS = {
    analysis: {
        queueType: 'analysis_processing',
        cleanupScope: 'analysis'
    },
    raster: {
        queueType: 'trajectory_rasterization',
        cleanupScope: 'raster'
    },
    glb: {
        queueType: 'trajectory_glb_conversion',
        cleanupScope: 'glb'
    },
    artifactUpload: {
        queueType: 'artifact_upload',
        cleanupScope: 'artifact-upload'
    }
} as const;

export const swallow = (message: string, context: Record<string, unknown>) =>
    (err: unknown) => logger.warn({
        ...context,
        err
    }, `[DaemonAnalysisCompletion] ${message}`);

export interface ProjectedJobStatusInput {
    jobId: string;
    teamId: string;
    teamClusterId?: string;
    status: JobStatus;
    queueType: string;
    cleanupScope: string;
    name?: string;
    analysisId?: string;
    trajectoryContext: JobTrajectoryContext;
    error?: string;
}

export type AnalysisStatusPublication = Omit<AnalysisStatusChangedEventPayload, 'trajectoryId'>
    & { trajectoryId?: string };

/**
 * Publishes the domain events that daemon job reports project onto the event
 * bus: per-job status transitions plus analysis status / stage snapshots.
 */
class DaemonJobStatusPublisher {
    private readonly eventBus = eventBus;

    async publishJobStatusChanged(input: ProjectedJobStatusInput): Promise<void> {
        const { trajectoryContext, ...job } = input;
        await this.eventBus.emit('job.status.changed', {
            ...job,
            ...trajectoryContext,
            source: PROJECTED_JOB_SOURCE,
            backingSource: PROJECTED_JOB_BACKING_SOURCE
        });
    }

    async publishJobStatusChangedBatch(events: ProjectedJobStatusInput[]): Promise<void> {
        for (let index = 0; index < events.length; index += JOB_STATUS_PUBLISH_BATCH_SIZE) {
            const chunk = events.slice(index, index + JOB_STATUS_PUBLISH_BATCH_SIZE);
            await Promise.all(chunk.map((event) => this.publishJobStatusChanged(event)));
        }
    }

    async publishAnalysisStatus(input: AnalysisStatusPublication): Promise<void> {
        await this.eventBus.emit('analysis.status.changed', {
            ...input,
            trajectoryId: input.trajectoryId ?? ''
        }).catch(swallow('Failed to publish analysis.status.changed', {
            analysisId: input.analysisId,
            status: input.status
        }));
    }

    async publishAnalysisStageChanged(analysis: Analysis, teamId: string, trajectoryId: string): Promise<void> {
        await this.eventBus.emit('analysis.stage.changed', {
            analysisId: analysis._id,
            trajectoryId,
            teamId,
            artifactStatus: analysis.props.artifactStatus,
            expectedArtifacts: analysis.props.expectedArtifacts,
            stages: analysis.props.stages,
            childAnalyses: analysis.props.childAnalyses
        });
    }
}

export default new DaemonJobStatusPublisher();
