import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import TeamJobProjectedEvent from '@modules/jobs/domain/events/TeamJobProjectedEvent';
import TeamJobProjectionService from '@modules/jobs/infrastructure/services/TeamJobProjectionService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { JobStatusChangedMetadata, JobStatusChangedValue } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';

const isJobStatusChangedValue = (value: unknown): value is JobStatusChangedValue => {
    return value === 'queued'
        || value === 'running'
        || value === 'completed'
        || value === 'failed'
        || value === 'retrying';
};

const toProjectedMetadata = (snapshot: TeamJobSnapshot): JobStatusChangedMetadata | undefined => {
    if (!snapshot.metadata) {
        return undefined;
    }

    const { status: rawStatus, ...restMetadata } = snapshot.metadata;
    const status = isJobStatusChangedValue(snapshot.metadata.status)
        ? snapshot.metadata.status
        : undefined;

    return {
        ...restMetadata,
        ...(status ? { status } : {})
    };
};

@injectable()
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(TeamJobProjectionService)
        private readonly teamJobProjectionService: TeamJobProjectionService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { jobId } = event.payload;
        let snapshot: TeamJobSnapshot;

        try {
            snapshot = await this.teamJobProjectionService.upsertFromStatusChangedEvent(event.payload);
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to persist projected job snapshot ${jobId}`);
            return;
        }

        try {
            await this.eventBus.publish(new TeamJobProjectedEvent({
                jobId: snapshot.jobId,
                teamId: snapshot.teamId,
                queueType: snapshot.queueType,
                status: snapshot.status,
                metadata: toProjectedMetadata(snapshot),
                timestamp: snapshot.timestamp,
                createdAt: snapshot.createdAt,
                updatedAt: snapshot.updatedAt,
                name: snapshot.name,
                message: snapshot.message,
                analysisId: snapshot.analysisId,
                trajectoryId: snapshot.trajectoryId,
                trajectoryName: snapshot.trajectoryName,
                timestep: snapshot.timestep,
                teamClusterId: snapshot.teamClusterId,
                source: snapshot.source,
                backingSource: snapshot.backingSource,
                cleanupScope: snapshot.cleanupScope
            }));
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to publish projected team job event ${jobId}`);
        }
    }
}
