import { ErrorCodes } from '@core/constants/error-codes';
import Analysis from '@modules/analysis/models/Analysis';
import analysisExecutionLogService, {
    ANALYSIS_LOG_SOCKET_EVENTS,
    getAnalysisLogRoom,
    type AnalysisLogChunkEventPayload
} from '@modules/analysis/services/AnalysisExecutionLogService';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';

interface SubscribePayload{
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

interface UnsubscribePayload{
    analysisId: string;
    timestep: number;
}

class AnalysisLogSocketModule extends BaseSocketModule{
    public readonly name = 'AnalysisLogSocketModule';

    private readonly teamSubscriptionCoordinator = socketTeamSubscriptionCoordinator;

    constructor(){
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    onConnection(connection: ISocketConnection): void{
        if(!connection.user){
            return;
        }

        this.on<SubscribePayload>(connection.id, ANALYSIS_LOG_SOCKET_EVENTS.SUBSCRIBE, async (conn, payload) => {
            const currentTeamId = this.teamSubscriptionCoordinator.getCurrentTeamId(conn);
            if(!currentTeamId){
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_ID_REQUIRED, 'No team selected');
                return;
            }

            const analysis = await Analysis.findOneBy({ id: payload.analysisId });
            if(!analysis || analysis.team !== currentTeamId){
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not allowed to subscribe to this analysis log'
                );
                return;
            }

            const room = getAnalysisLogRoom(payload.analysisId, payload.timestep);
            await this.joinRoom(conn.id, room);

            if(!payload.afterCursor){
                return;
            }

            const replay = await analysisExecutionLogService.getFrameLog({
                analysisId: payload.analysisId,
                teamId: currentTeamId,
                trajectoryId: analysis.trajectory,
                timestep: payload.timestep,
                afterCursor: payload.afterCursor
            });

            if(replay.segments.length === 0 && !replay.sealed){
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
