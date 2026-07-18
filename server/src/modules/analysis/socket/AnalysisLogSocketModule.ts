import { ErrorCodes } from '@core/constants/error-codes';
import type { IAnalysisRepository } from '@modules/analysis/ports/IAnalysisRepository';
import type { IAnalysisExecutionLogService } from '@modules/analysis/ports/IAnalysisExecutionLogService';
import { ANALYSIS_TOKENS } from '@modules/analysis/di/AnalysisTokens';
import {
    ANALYSIS_LOG_SOCKET_EVENTS,
    getAnalysisLogRoom,
    type AnalysisLogChunkEventPayload
} from '@modules/analysis/services/AnalysisExecutionLogService';
import type { ISocketConnection } from '@modules/socket/ports/ISocketModule';
import { SOCKET_CONTRACT_TOKENS } from '@shared/contracts/tokens/SocketTokens';
import SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface SubscribePayload {
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

interface UnsubscribePayload {
    analysisId: string;
    timestep: number;
}

@Singleton()
@AliasOf(SOCKET_CONTRACT_TOKENS.SocketModule)
export default class AnalysisLogSocketModule extends BaseSocketModule {
    public readonly name = 'AnalysisLogSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService) private readonly analysisExecutionLogService: IAnalysisExecutionLogService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.on<SubscribePayload>(connection.id, ANALYSIS_LOG_SOCKET_EVENTS.SUBSCRIBE, async (conn, payload) => {
            const currentTeamId = this.teamSubscriptionCoordinator.getCurrentTeamId(conn);
            if (!currentTeamId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_ID_REQUIRED, 'No team selected');
                return;
            }

            const analysis = await this.analysisRepository.findById(payload.analysisId);
            if (!analysis || analysis.props.team !== currentTeamId) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not allowed to subscribe to this analysis log'
                );
                return;
            }

            const room = getAnalysisLogRoom(payload.analysisId, payload.timestep);
            await this.joinRoom(conn.id, room);

            if (!payload.afterCursor) {
                return;
            }

            const replay = await this.analysisExecutionLogService.getFrameLog({
                analysisId: payload.analysisId,
                teamId: currentTeamId,
                trajectoryId: analysis.props.trajectory,
                timestep: payload.timestep,
                afterCursor: payload.afterCursor
            });

            if (replay.segments.length === 0 && !replay.sealed) {
                return;
            }

            const payloadToEmit: AnalysisLogChunkEventPayload = {
                analysisId: replay.analysisId,
                timestep: replay.timestep,
                cursor: replay.nextCursor,
                segments: replay.segments,
                sealed: replay.sealed,
                status: replay.status,
                truncated: replay.truncated
            };

            this.emitToSocket(conn.id, ANALYSIS_LOG_SOCKET_EVENTS.CHUNK, payloadToEmit);
        });

        this.on<UnsubscribePayload>(connection.id, ANALYSIS_LOG_SOCKET_EVENTS.UNSUBSCRIBE, async (conn, payload) => {
            await this.leaveRoom(
                conn.id,
                getAnalysisLogRoom(payload.analysisId, payload.timestep)
            );
        });
    }
}
