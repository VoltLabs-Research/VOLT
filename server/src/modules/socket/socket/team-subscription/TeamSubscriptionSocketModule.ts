import { ErrorCodes } from '@core/constants/error-codes';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import type {
    ISocketConnection,
    ISocketConnectionUser
} from '@modules/socket/socket/ISocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import type { SubscribeToTeamSocketPayload } from '@modules/socket/socket/team-subscription/team-subscription';
import TeamMember from '@modules/team/models/TeamMember';
import { addTeamToUser } from '@modules/team/services/team/user-team-links';

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

const ackOk = <T>(data?: T): SocketAck<T> => ({
    ok: true,
    data
});
const ackError = (error: string): SocketAck<never> => ({
    ok: false,
    error
});

class TeamSubscriptionSocketModule extends BaseSocketModule {
    public readonly name = 'TeamSubscriptionSocketModule';

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
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

            const isMember = await TeamMember.existsBy({
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

            const previousTeamId = payload.previousTeamId ?? socketTeamSubscriptionCoordinator.getCurrentTeamId(conn);
            const previousRoomName = previousTeamId ? `team:${previousTeamId}` : undefined;
            const roomName = `team:${payload.teamId}`;

            if (previousRoomName && previousRoomName !== roomName) {
                await this.leaveRoom(conn.id, previousRoomName);
            }

            await this.joinRoom(conn.id, roomName);
            socketTeamSubscriptionCoordinator.setCurrentTeamId(conn, payload.teamId);

            await socketTeamSubscriptionCoordinator.notify({
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
            socketTeamSubscriptionCoordinator.clearCurrentTeamId(conn);
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

        await addTeamToUser(userId, teamId);

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

const teamSubscriptionSocketModule = new TeamSubscriptionSocketModule();

export default teamSubscriptionSocketModule;
