import JobStatusChangedEvent from '@modules/jobs/events/JobStatusChangedEvent';
import TeamJobProjectionService from '@modules/jobs/services/TeamJobProjectionService';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';
import { SOCKET_CONTRACT_TOKENS } from '@shared/contracts/tokens/SocketTokens';
import type { ISocketEmitter } from '@modules/socket/ports/ISocketEmitter';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Subscribe('job.status.changed')
export default class ProjectTeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        private readonly teamJobProjectionService: TeamJobProjectionService,
        @inject(SOCKET_CONTRACT_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
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
