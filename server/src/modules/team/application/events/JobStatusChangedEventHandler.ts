import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import JobStatusChangedEvent from '@modules/jobs/application/events/JobStatusChangedEvent';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { ISocketEmitter } from '@modules/socket/domain/ports/ISocketEmitter';

@injectable()
export default class TeamJobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
    ){}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { teamId, jobId, status, queueType, metadata } = event.data;

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
