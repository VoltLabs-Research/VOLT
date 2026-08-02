import { ErrorCodes } from '@core/constants/error-codes';
import { resolveAccessibleChat } from '@modules/chat/services/chat-access';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { ackError, ackOk } from '@modules/socket/socket/socket-ack';
import TeamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import type { SocketAck } from '@modules/socket/socket/socket-ack';
import type ApplicationError from '@shared/application/errors/ApplicationError';

interface TypingPayload {
    chatId: string;
}

interface UsersPresencePayload {
    userIds: string[];
}

class ChatSocketModule extends BaseSocketModule {
    public readonly name = 'ChatSocketModule';

    private readonly teamRoomPresenceService = new TeamRoomPresenceService();

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<string>(connection.id, 'join_chat', async (conn, chatId) => {
            const currentUserId = this.getCurrentUserId(conn);
            if (!currentUserId) {
                return this.rejectAuthentication(conn.id);
            }

            let teamId: string;
            try {
                teamId = (await resolveAccessibleChat(chatId, currentUserId)).team;
            } catch (error) {
                return this.rejectApplicationError(conn.id, error as ApplicationError);
            }

            const previousChatId = conn.data.currentChatId;
            if (previousChatId && previousChatId !== chatId) {
                await this.cleanupActiveChat(conn, true);
            }

            await this.joinRoom(conn.id, this.buildChatRoomName(chatId));
            conn.data.currentChatId = chatId;
            conn.data.currentChatTeamId = teamId;

            return ackOk();
        });

        this.on<string>(connection.id, 'leave_chat', async (conn, chatId) => {
            if (conn.data.currentChatId === chatId) {
                await this.cleanupActiveChat(conn, true);
                return ackOk();
            }

            await this.leaveRoom(conn.id, this.buildChatRoomName(chatId));
            return ackOk();
        });

        this.on<TypingPayload>(connection.id, 'typing_start', (conn, payload) => (
            this.handleTypingEvent(conn, payload.chatId, true)
        ));

        this.on<TypingPayload>(connection.id, 'typing_stop', (conn, payload) => (
            this.handleTypingEvent(conn, payload.chatId, false)
        ));

        this.on<UsersPresencePayload>(connection.id, 'get_users_presence', async (conn, payload) => {
            const teamId = conn.data.currentChatTeamId;
            if (!teamId) {
                return this.rejectInactiveChat(conn.id);
            }

            const onlineUserIds = new Set(await this.teamRoomPresenceService.getOnlineUserIds(teamId));
            const presenceMap = Object.fromEntries(
                payload.userIds.map((userId) => [userId, onlineUserIds.has(userId) ? 'online' : 'offline'])
            );

            this.emitToSocket(conn.id, 'users_presence_info', presenceMap);
            return ackOk();
        });

        this.onDisconnect(connection.id, async (conn) => {
            await this.cleanupActiveChat(conn, false);
        });
    }

    private handleTypingEvent(connection: ISocketConnection, chatId: string, isTyping: boolean): SocketAck {
        if (!this.getCurrentUserId(connection)) {
            return this.rejectAuthentication(connection.id);
        }

        if (connection.data.currentChatId !== chatId) {
            return this.rejectInactiveChat(connection.id);
        }

        this.emitTypingState(chatId, connection, isTyping, true);
        return ackOk();
    }

    private async cleanupActiveChat(connection: ISocketConnection, leaveRoom: boolean): Promise<void> {
        const activeChatId = connection.data.currentChatId;
        delete connection.data.currentChatId;
        delete connection.data.currentChatTeamId;

        if (!activeChatId) {
            return;
        }

        this.emitTypingState(activeChatId, connection, false, leaveRoom);

        if (leaveRoom) {
            await this.leaveRoom(connection.id, this.buildChatRoomName(activeChatId));
        }
    }

    private emitTypingState(
        chatId: string,
        connection: ISocketConnection,
        isTyping: boolean,
        excludeSender: boolean
    ): void {
        const userId = this.getCurrentUserId(connection);
        if (!userId) {
            return;
        }

        const payload = {
            chatId,
            userId,
            userName: this.getUserDisplayName(connection),
            isTyping
        };
        const room = this.buildChatRoomName(chatId);

        if (excludeSender) {
            this.emitToRoomExcept(connection.id, room, 'user_typing', payload);
            return;
        }

        this.emitToRoom(room, 'user_typing', payload);
    }

    private getCurrentUserId(connection: ISocketConnection): string | undefined {
        return connection.user?._id ?? connection.userId;
    }

    private getUserDisplayName(connection: ISocketConnection): string {
        const fullName = [connection.user?.firstName, connection.user?.lastName]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(' ');

        return fullName || connection.user?.email?.split('@')[0]?.trim() || 'A team member';
    }

    private buildChatRoomName(chatId: string): string {
        return `chat-${chatId}`;
    }

    private rejectAuthentication(socketId: string): SocketAck<never> {
        const message = 'Authentication required';
        this.emitErrorToSocket(socketId, ErrorCodes.AUTHENTICATION_REQUIRED, message);
        return ackError(message);
    }

    private rejectInactiveChat(socketId: string): SocketAck<never> {
        const message = 'Socket is not subscribed to this chat';
        this.emitErrorToSocket(socketId, ErrorCodes.VALIDATION_INVALID_INPUT, message);
        return ackError(message);
    }

    private rejectApplicationError(socketId: string, error: ApplicationError): SocketAck<never> {
        this.emitErrorToSocket(socketId, error.code, error.message);
        return ackError(error.message);
    }
}

export default new ChatSocketModule();
