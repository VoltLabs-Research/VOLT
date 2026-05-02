import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import TeamJobProjectionService from '@modules/jobs/infrastructure/services/TeamJobProjectionService';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('job.status.changed')
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        private readonly teamJobProjectionService: TeamJobProjectionService,
        private readonly socketEmitter: SocketIOEmitter
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
            await this.socketEmitter.emitToRoom(`team:${snapshot.teamId}`, 'team.job.updated', {
                ...snapshot,
                timestamp: snapshot.timestamp ?? new Date().toISOString()
            });
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to emit projected team job update ${jobId}`);
        }
    }
}
