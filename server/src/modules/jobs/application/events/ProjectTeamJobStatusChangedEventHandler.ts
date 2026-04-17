import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import TeamJobProjectionService from '@modules/jobs/infrastructure/services/TeamJobProjectionService';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';

@injectable()
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(TeamJobProjectionService)
        private readonly teamJobProjectionService: TeamJobProjectionService,

        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
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
