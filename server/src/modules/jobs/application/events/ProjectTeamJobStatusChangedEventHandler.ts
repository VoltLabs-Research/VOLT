import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import type { ITeamJobProjectionService } from '@modules/jobs/domain/port/ITeamJobProjectionService';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Subscribe('job.status.changed')
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobProjectionService) private readonly teamJobProjectionService: ITeamJobProjectionService,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ) {}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { jobId } = event.payload;
        let snapshot: TeamJobSnapshot | null;

        try {
            snapshot = await this.teamJobProjectionService.upsertFromStatusChangedEvent(event.payload);
        } catch (error) {
            logger.warn(error, `[ProjectTeamJobStatusChangedEventHandler] Failed to persist projected job snapshot ${jobId}`);
            return;
        }

        if (!snapshot) {
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
