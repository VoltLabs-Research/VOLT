import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import {
    ANALYSIS_LOG_SOCKET_EVENTS,
    getAnalysisLogRoom,
    type AnalysisLogChunkEventPayload
} from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import { ErrorCodes } from '@core/constants/error-codes';
import { inject, singleton } from 'tsyringe';
import { z } from 'zod/v4';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';

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

@singleton()
export default class AnalysisLogSocketModule extends BaseSocketModule {
    public readonly name = 'AnalysisLogSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService)
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
