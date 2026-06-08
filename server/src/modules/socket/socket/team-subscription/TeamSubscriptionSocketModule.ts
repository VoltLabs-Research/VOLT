import { ErrorCodes } from '@core/constants/error-codes';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import type { SubscribeToTeamSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import type { ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

const ackOk = <T>(data?: T): SocketAck<T> => ({ ok: true, data });
const ackError = (error: string): SocketAck<never> => ({ ok: false, error });

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamSubscriptionSocketModule extends BaseSocketModule {
    public readonly name = 'TeamSubscriptionSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly teamSubscriptionService: SocketTeamSubscriptionCoordinator,
        private readonly teamMemberRepository: TeamMemberRepository,
        private readonly userRepository: UserRepository
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<SubscribeToTeamSocketPayload>(connection.id, 'subscribe_to_team', async (conn, payload) => {
            const currentUserId = conn.user?._id ?? conn.userId;
            if (!currentUserId) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.AUTHENTICATION_UNAUTHORIZED,
                    ErrorCodes.AUTHENTICATION_UNAUTHORIZED
                );
                return ackError(ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
            }

            const isMember = await this.teamMemberRepository.exists({
                user: currentUserId,
                team: payload.teamId
            });

            if (!isMember) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                    'You are not a member of this team'
                );
                return ackError('You are not a member of this team');
            }

            await this.repairMembershipSnapshot(conn, currentUserId, payload.teamId);

            const previousTeamId = payload.previousTeamId ?? this.teamSubscriptionService.getCurrentTeamId(conn);
            const previousRoomName = previousTeamId ? `team:${previousTeamId}` : undefined;
            const roomName = `team:${payload.teamId}`;

            if (previousRoomName && previousRoomName !== roomName) {
                await this.leaveRoom(conn.id, previousRoomName);
            }

            await this.joinRoom(conn.id, roomName);
            this.teamSubscriptionService.setCurrentTeamId(conn, payload.teamId);

            await this.teamSubscriptionService.notify({
                connection: conn,
                subscription: {
                    teamId: payload.teamId,
                    previousTeamId,
                    roomName,
                    previousRoomName
                }
            });

            return ackOk();
        });

        this.onDisconnect(connection.id, async (conn) => {
            this.teamSubscriptionService.clearCurrentTeamId(conn);
        });
    }

    private async repairMembershipSnapshot(
        connection: ISocketConnection,
        userId: string,
        teamId: string
    ): Promise<void> {
        if (connection.user?.teams?.includes(teamId)) {
            return;
        }

        await this.userRepository.addTeamToUser(userId, teamId);

        const nextTeams = this.mergeTeamId(connection.user?.teams, teamId);
        const auth = connection.data.auth;
        const authUser = auth?.user;

        if (auth && authUser) {
            connection.data.auth = {
                ...auth,
                user: {
                    ...authUser,
                    teams: this.mergeTeamId(authUser.teams, teamId)
                }
            };
        }

        const nativeSocket = connection.nativeSocket as (typeof connection.nativeSocket & {
            user?: ISocketConnectionUser;
        });

        if (nativeSocket?.user) {
            nativeSocket.user = {
                ...nativeSocket.user,
                teams: nextTeams
            };
        }
    }

    private mergeTeamId(teams: string[] | undefined, teamId: string): string[] {
        return Array.from(new Set([...(teams ?? []), teamId]));
    }
}
