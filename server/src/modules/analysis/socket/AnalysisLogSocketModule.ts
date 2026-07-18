import { ErrorCodes } from '@core/constants/error-codes';
import type AnalysisRepository from '@modules/analysis/repositories/AnalysisRepository';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import analysisExecutionLogService, {
    ANALYSIS_LOG_SOCKET_EVENTS,
    getAnalysisLogRoom,
    type AnalysisLogChunkEventPayload
} from '@modules/analysis/services/AnalysisExecutionLogService';
import type { ISocketConnection } from '@modules/socket/ports/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { container as diContainer } from 'tsyringe';

interface SubscribePayload {
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

interface UnsubscribePayload {
    analysisId: string;
    timestep: number;
}

export class AnalysisLogSocketModule extends BaseSocketModule {
    public readonly name = 'AnalysisLogSocketModule';

    private readonly teamSubscriptionCoordinator = socketTeamSubscriptionCoordinator;

    // `AnalysisRepository` is still resolved from the tsyringe container
    // (registered in `registerAllDependencies`, which hasn't run yet when
    // this module is constructed at import time), so it must stay lazy —
    // resolved on first actual use — to avoid the eager-singleton DI boot race.
    #analysisRepositoryCache?: AnalysisRepository;
    private get analysisRepository(): AnalysisRepository {
        return (this.#analysisRepositoryCache ??= diContainer.resolve<AnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository));
    }

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
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

            const replay = await analysisExecutionLogService.getFrameLog({
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

export default new AnalysisLogSocketModule();
