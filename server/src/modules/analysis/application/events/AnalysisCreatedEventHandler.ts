import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import AnalysisCreatedEvent from '@modules/analysis/domain/events/AnalysisCreatedEvent';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { ISocketEmitter } from '@modules/socket/domain/ports/ISocketEmitter';

@injectable()
export default class AnalysisCreatedEventHandler implements IEventHandler<AnalysisCreatedEvent> {
    constructor(
        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
    ){}

    async handle(event: AnalysisCreatedEvent): Promise<void> {
        const { teamId, trajectoryId, analysisId, pluginSlug, config, status, createdAt } = event.payload;

        if (teamId) {
            await this.socketEmitter.emitToRoom(
                `team:${teamId}`,
                'analysis.created',
                {
                    analysisId,
                    trajectoryId,
                    pluginSlug,
                    config,
                    status,
                    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
                    teamId
                }
            );
        }
    }
}
