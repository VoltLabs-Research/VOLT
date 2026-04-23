import { ErrorCodes } from '@core/constants/error-codes';
import type { SubscribeToTeamSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import { subscribeToTeamSocketPayloadSchema } from '@modules/socket/utilities/team-subscription-schemas';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamSubscriptionSocketModule extends BaseSocketModule {
    public readonly name = 'TeamSubscriptionSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        
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

            if (!conn.user || !conn.user.teams?.includes(parsed.data.teamId)) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
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
