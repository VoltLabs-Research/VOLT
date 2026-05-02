import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisExecutionLogService, {
    ANALYSIS_LOG_SOCKET_EVENTS,
    getAnalysisLogRoom,
    type AnalysisLogChunkEventPayload
} from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import { z } from 'zod/v4';

const subscribeSchema = z.object({
    analysisId: z.string().trim().min(1),
    timestep: z.number().int(),
    afterCursor: z.string().trim().min(1).optional()
}).strict();

const unsubscribeSchema = z.object({
    analysisId: z.string().trim().min(1),
    timestep: z.number().int()
}).strict();

type SubscribePayload = z.infer<typeof subscribeSchema>;
type UnsubscribePayload = z.infer<typeof unsubscribeSchema>;

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class AnalysisLogSocketModule extends BaseSocketModule {
    public readonly name = 'AnalysisLogSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        private readonly analysisRepository: AnalysisRepository,
        private readonly analysisExecutionLogService: AnalysisExecutionLogService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.on<SubscribePayload>(connection.id, ANALYSIS_LOG_SOCKET_EVENTS.SUBSCRIBE, async (conn, payload) => {
            const parsed = subscribeSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            const currentTeamId = this.teamSubscriptionCoordinator.getCurrentTeamId(conn);
            if (!currentTeamId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_ID_REQUIRED, 'No team selected');
                return;
            }

            const analysis = await this.analysisRepository.findById(parsed.data.analysisId);
            if (!analysis || analysis.props.team !== currentTeamId) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not allowed to subscribe to this analysis log'
                );
                return;
            }

            const room = getAnalysisLogRoom(parsed.data.analysisId, parsed.data.timestep);
            await this.joinRoom(conn.id, room);

            if (!parsed.data.afterCursor) {
                return;
            }

            const replay = await this.analysisExecutionLogService.getFrameLog({
                analysisId: parsed.data.analysisId,
                teamId: currentTeamId,
                trajectoryId: analysis.props.trajectory,
                timestep: parsed.data.timestep,
                afterCursor: parsed.data.afterCursor
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
            const parsed = unsubscribeSchema.safeParse(payload);
            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            await this.leaveRoom(
                conn.id,
                getAnalysisLogRoom(parsed.data.analysisId, parsed.data.timestep)
            );
        });
    }
}
