import { inject, singleton } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { SubscribeToTeamSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import SocketTeamSubscriptionCoordinator from '@modules/socket/services/team-subscription/SocketTeamSubscriptionCoordinator';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { subscribeToTeamSocketPayloadSchema } from '@modules/socket/infrastructure/validation/team-subscription-schemas';
import { formatSocketValidationError } from '@modules/socket/infrastructure/utilities/socket-validation-error';

@singleton()
export default class TeamSubscriptionSocketModule extends BaseSocketModule {
    public readonly name = 'TeamSubscriptionSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionService: SocketTeamSubscriptionCoordinator
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<SubscribeToTeamSocketPayload>(connection.id, 'subscribe_to_team', async (conn, payload) => {
            const parsed = subscribeToTeamSocketPayloadSchema.safeParse(payload);

            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            const previousTeamId = parsed.data.previousTeamId ?? this.teamSubscriptionService.getCurrentTeamId(conn);
            const previousRoomName = previousTeamId ? `team:${previousTeamId}` : undefined;
            const roomName = `team:${parsed.data.teamId}`;

            if (previousRoomName && previousRoomName !== roomName) {
                await this.leaveRoom(conn.id, previousRoomName);
            }

            await this.joinRoom(conn.id, roomName);
            this.teamSubscriptionService.setCurrentTeamId(conn, parsed.data.teamId);

            await this.teamSubscriptionService.notify({
                connection: conn,
                subscription: {
                    teamId: parsed.data.teamId,
                    previousTeamId,
                    roomName,
                    previousRoomName
                }
            });
        });

        this.onDisconnect(connection.id, async (conn) => {
            this.teamSubscriptionService.clearCurrentTeamId(conn);
        });
    }
}
