import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import teamJobProjectionService from '@modules/jobs/services/TeamJobProjectionService';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import logger from '@shared/infrastructure/logger';

@DefineEventGroup('jobs')
export default class JobsEvents {
    @Event('job.status.changed')
    async projectTeamJobSnapshot(payload: EventMap['job.status.changed']) {
        const { jobId } = payload;
        let snapshot: TeamJobSnapshot | null;

        try {
            snapshot = await teamJobProjectionService.upsertFromStatusChangedEvent(payload);
        } catch (error) {
            logger.warn(error, `[JobsEvents] Failed to persist projected job snapshot ${jobId}`);
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
            logger.warn(error, `[JobsEvents] Failed to emit projected team job update ${jobId}`);
        }
    }
}
