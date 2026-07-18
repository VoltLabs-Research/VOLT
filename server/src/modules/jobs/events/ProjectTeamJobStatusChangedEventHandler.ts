import JobStatusChangedEvent from '@modules/jobs/events/JobStatusChangedEvent';
import teamJobProjectionService from '@modules/jobs/services/TeamJobProjectionService';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('job.status.changed')
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { jobId } = event.payload;
        let snapshot: TeamJobSnapshot | null;

        try {
            snapshot = await teamJobProjectionService.upsertFromStatusChangedEvent(event.payload);
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to persist projected job snapshot ${jobId}`);
            return;
        }

        if (!snapshot) {
            return;
        }

        try {
            await socketIOEmitter.emitToRoom(`team:${snapshot.teamId}`, 'team.job.updated', {
                ...snapshot,
                timestamp: snapshot.timestamp ?? new Date().toISOString()
            });
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to emit projected team job update ${jobId}`);
        }
    }
}
