import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class TeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
    ){}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { teamId, jobId, status, queueType, metadata } = event.payload;

        if (teamId) {
            await this.socketEmitter.emitToRoom(
                `team:${teamId}`,
                'team.job.updated',
                {
                    ...metadata,
                    jobId,
                    status,
                    queueType,
                    timestamp: new Date().toISOString(),
                    trajectoryId: metadata?.trajectoryId,
                    timestep: metadata?.timestep,
                    message: metadata?.message,
                    analysisId: metadata?.analysisId,
                    teamId
                }
            );
        }
    }
};
