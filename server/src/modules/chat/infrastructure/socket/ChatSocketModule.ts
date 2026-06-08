import { ErrorCodes } from '@core/constants/error-codes';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import TeamRoomPresenceService from '@modules/team/infrastructure/services/team-member/TeamRoomPresenceService';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';

const SOCKET_CHAT_EVENTS = {
    JOIN_CHAT: 'join_chat',
    LEAVE_CHAT: 'leave_chat',
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    GET_USERS_PRESENCE: 'get_users_presence',
    USER_TYPING: 'user_typing',
    USERS_PRESENCE_INFO: 'users_presence_info'
} as const;

type PresenceStatus = 'online' | 'offline';

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

interface TypingPayload {
    chatId: string;
}

interface UsersPresencePayload {
    userIds: string[];
}

const ackOk = <T>(data?: T): SocketAck<T> => ({ ok: true, data });
const ackError = (error: string): SocketAck<never> => ({ ok: false, error });

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class ChatSocketModule extends BaseSocketModule {
    public readonly name = 'ChatSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly chatRepository: ChatRepository,
        private readonly teamRoomPresenceService: TeamRoomPresenceService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<string>(connection.id, SOCKET_CHAT_EVENTS.JOIN_CHAT, async (conn, payload) => {
            const currentUserId = this.getCurrentUserId(conn);
            if (!currentUserId) {
                return this.rejectAuthentication(conn.id);
            }

            const chatResult = await resolveAccessibleChat(this.chatRepository, payload, currentUserId);
            if (!chatResult.success) {
                return this.rejectApplicationError(conn.id, chatResult.error);
            }

            const previousChatId = this.getCurrentChatId(conn);
            if (previousChatId && previousChatId !== payload) {
                await this.cleanupActiveChat(conn, true);
            }

            await this.joinRoom(conn.id, this.buildChatRoomName(payload));
            this.setCurrentChatContext(conn, payload, this.resolveTeamId(chatResult.value.props.team));

            return ackOk();
        });

        this.on<string>(connection.id, SOCKET_CHAT_EVENTS.LEAVE_CHAT, async (conn, payload) => {
            if (this.getCurrentChatId(conn) === payload) {
                await this.cleanupActiveChat(conn, true);
                return ackOk();
            }

            await this.leaveRoom(conn.id, this.buildChatRoomName(payload));
            return ackOk();
        });

        this.on<TypingPayload>(connection.id, SOCKET_CHAT_EVENTS.TYPING_START, async (conn, payload) => {
            return this.handleTypingEvent(conn, payload, true);
        });

        this.on<TypingPayload>(connection.id, SOCKET_CHAT_EVENTS.TYPING_STOP, async (conn, payload) => {
            return this.handleTypingEvent(conn, payload, false);
        });

        this.on<UsersPresencePayload>(connection.id, SOCKET_CHAT_EVENTS.GET_USERS_PRESENCE, async (conn, payload) => {
            const teamId = this.getCurrentChatTeamId(conn);
            if (!teamId) {
                return this.rejectInactiveChat(conn.id);
            }

            const uniqueUserIds = Array.from(new Set(payload.userIds));
            const onlineUserIds = await this.teamRoomPresenceService.getOnlineUserIds(teamId);
            const onlineUserIdsSet = new Set(onlineUserIds);
            const presenceMap = uniqueUserIds.reduce<Record<string, PresenceStatus>>((acc, userId) => {
                acc[userId] = onlineUserIdsSet.has(userId) ? 'online' : 'offline';
                return acc;
            }, {});

            this.emitToSocket(conn.id, SOCKET_CHAT_EVENTS.USERS_PRESENCE_INFO, presenceMap);
            return ackOk(presenceMap);
        });

        this.onDisconnect(connection.id, async (conn) => {
            await this.cleanupActiveChat(conn, false);
        });
    }

    private async handleTypingEvent(
        connection: ISocketConnection,
        payload: TypingPayload,
        isTyping: boolean
    ): Promise<SocketAck> {
        if (!this.getCurrentUserId(connection)) {
            return this.rejectAuthentication(connection.id);
        }

        if (this.getCurrentChatId(connection) !== payload.chatId) {
            return this.rejectInactiveChat(connection.id);
        }

        this.emitTypingState(payload.chatId, connection, isTyping, true);
        return ackOk();
    }

    private async cleanupActiveChat(connection: ISocketConnection, leaveRoom: boolean): Promise<void> {
        const activeChatId = this.getCurrentChatId(connection);
        if (!activeChatId) {
            this.clearCurrentChatContext(connection);
            return;
        }

        this.emitTypingState(activeChatId, connection, false, leaveRoom);

        if (leaveRoom) {
            await this.leaveRoom(connection.id, this.buildChatRoomName(activeChatId));
        }

        this.clearCurrentChatContext(connection);
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
            this.emitToRoomExcept(connection.id, room, SOCKET_CHAT_EVENTS.USER_TYPING, payload);
            return;
        }

        this.emitToRoom(room, SOCKET_CHAT_EVENTS.USER_TYPING, payload);
    }

    private getCurrentUserId(connection: ISocketConnection): string | undefined {
        return connection.user?._id ?? connection.userId;
    }

    private getUserDisplayName(connection: ISocketConnection): string {
        const firstName = connection.user?.firstName?.trim();
        const lastName = connection.user?.lastName?.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

        if (fullName) {
            return fullName;
        }

        const emailLocalPart = connection.user?.email?.split('@')[0]?.trim();
        return emailLocalPart || 'A team member';
    }

    private getCurrentChatId(connection: ISocketConnection): string | undefined {
        const currentChatId = connection.data.currentChatId;
        return typeof currentChatId === 'string' && currentChatId.length > 0
            ? currentChatId
            : undefined;
    }

    private getCurrentChatTeamId(connection: ISocketConnection): string | undefined {
        const currentChatTeamId = connection.data.currentChatTeamId;
        return typeof currentChatTeamId === 'string' && currentChatTeamId.length > 0
            ? currentChatTeamId
            : undefined;
    }

    private setCurrentChatContext(connection: ISocketConnection, chatId: string, teamId: string): void {
        connection.data.currentChatId = chatId;
        connection.data.currentChatTeamId = teamId;
    }

    private clearCurrentChatContext(connection: ISocketConnection): void {
        delete connection.data.currentChatId;
        delete connection.data.currentChatTeamId;
    }

    private buildChatRoomName(chatId: string): string {
        return `chat-${chatId}`;
    }

    private resolveTeamId(team: unknown): string {
        if (typeof team === 'string' && team.length > 0) {
            return team;
        }

        if (team && typeof team === 'object' && '_id' in team) {
            const teamId = (team as { _id?: { toString(): string } | string })._id;
            if (teamId) {
                return teamId.toString();
            }
        }

        return String(team);
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
