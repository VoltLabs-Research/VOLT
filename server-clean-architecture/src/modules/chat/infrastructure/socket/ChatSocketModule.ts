import { injectable, inject } from 'tsyringe';
import { ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { ISocketEmitter } from '@/src/modules/socket/domain/ports/ISocketEmitter';
import { ISocketRoomManager } from '@/src/modules/socket/domain/ports/ISocketRoomManager';
import { ISocketEventRegistry } from '@/src/modules/socket/domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '@/src/modules/socket/infrastructure/di/SocketTokens';
import { CHAT_TOKENS } from '../di/ChatTokens';
import { IChatRepository } from '../../domain/port/IChatRepository';
import { SendChatMessageUseCase } from '../../application/use-cases/chat-message/SendChatMessageUseCase';
import { SendFileMessageUseCase } from '../../application/use-cases/chat-message/SendFileMessageUseCase';
import { EditMessageUseCase } from '../../application/use-cases/chat-message/EditMessageUseCase';
import { DeleteMessageUseCase } from '../../application/use-cases/chat-message/DeleteMessageUseCase';
import { ToggleMessageReactionUseCase } from '../../application/use-cases/chat-message/ToggleMessageReactionUseCase';
import { MarkMessagesAsReadUseCase } from '../../application/use-cases/chat-message/MarkMessageAsReadUseCase';
import BaseSocketModule from '@/src/modules/socket/infrastructure/gateway/BaseSocketModule';
import logger from '@/src/shared/infrastructure/logger';

// Event payload types
interface SendMessagePayload {
    chatId: string;
    content: string;
    messageType?: string;
    metadata?: any;
}

interface SendFileMessagePayload {
    chatId: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
}

interface EditMessagePayload {
    chatId: string;
    messageId: string;
    content: string;
}

interface DeleteMessagePayload {
    chatId: string;
    messageId: string;
}

interface ToggleReactionPayload {
    chatId: string;
    messageId: string;
    emoji: string;
}

interface MarkReadPayload {
    chatId: string;
}

interface TypingPayload {
    chatId: string;
}

interface GetUsersPresencePayload {
    userIds: string[];
}

interface GroupUsersPayload {
    chatId: string;
    userIds: string[];
}

interface GroupInfoPayload {
    chatId: string;
    groupName?: string;
    groupDescription?: string;
}

interface UserLeftGroupPayload {
    chatId: string;
    userId: string;
}

/**
 * Socket module for real-time chat functionality.
 * Handles all chat-related events: messages, typing, reactions, groups, etc.
 */
@injectable()
export default class ChatSocketModule extends BaseSocketModule {
    public readonly name = 'ChatModule';

    // Track which users are online (socketId -> userId)
    private onlineUsers = new Map<string, string>();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        emitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        roomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        eventRegistry: ISocketEventRegistry,

        @inject(CHAT_TOKENS.ChatRepository)
        private readonly chatRepository: IChatRepository,

        @inject(CHAT_TOKENS.SendChatMessageUseCase)
        private readonly sendChatMessageUseCase: SendChatMessageUseCase,

        @inject(CHAT_TOKENS.SendFileMessageUseCase)
        private readonly sendFileMessageUseCase: SendFileMessageUseCase,

        @inject(CHAT_TOKENS.EditMessageUseCase)
        private readonly editMessageUseCase: EditMessageUseCase,

        @inject(CHAT_TOKENS.DeleteMessageUseCase)
        private readonly deleteMessageUseCase: DeleteMessageUseCase,

        @inject(CHAT_TOKENS.ToggleMessageReactionUseCase)
        private readonly toggleMessageReactionUseCase: ToggleMessageReactionUseCase,

        @inject(CHAT_TOKENS.MarkMessagesAsReadUseCase)
        private readonly markMessagesAsReadUseCase: MarkMessagesAsReadUseCase
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        const user = connection.user;

        if (!user) {
            // Anonymous connections cannot use chat
            return;
        }

        // Track online user
        this.onlineUsers.set(connection.id, user._id);

        // Join user's personal room for direct notifications
        this.joinRoom(connection.id, `user-${user._id}`);

        logger.info(`@chat-socket - user connected: ${user.firstName} ${user.lastName} (${connection.id})`);

        // Register all event handlers
        this.registerJoinChat(connection);
        this.registerLeaveChat(connection);
        this.registerSendMessage(connection);
        this.registerSendFileMessage(connection);
        this.registerEditMessage(connection);
        this.registerDeleteMessage(connection);
        this.registerToggleReaction(connection);
        this.registerMarkRead(connection);
        this.registerTypingStart(connection);
        this.registerTypingStop(connection);
        this.registerGetUsersPresence(connection);
        this.registerGroupEvents(connection);

        // Handle disconnect
        this.onDisconnect(connection.id, async (conn) => {
            this.onlineUsers.delete(conn.id);
            logger.info(`@chat-socket - user disconnected: ${conn.user?.firstName} ${conn.user?.lastName} (${conn.id})`);
        });
    }

    /**
     * Join a chat room
     */
    private registerJoinChat(connection: ISocketConnection): void {
        this.on<string>(connection.id, 'join_chat', async (conn, chatId) => {
            if (!conn.user) return;

            try {
                const hasAccess = await this.checkChatAccess(conn.user._id, chatId);
                if (!hasAccess) {
                    this.emitToSocket(conn.id, 'error', 'Chat not found or access denied');
                    return;
                }

                await this.joinRoom(conn.id, `chat-${chatId}`);
                this.emitToSocket(conn.id, 'joined_chat', { chatId });

                logger.info(`@chat-socket - user ${conn.user._id} joined chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - join_chat error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to join chat');
            }
        });
    }

    /**
     * Leave a chat room
     */
    private registerLeaveChat(connection: ISocketConnection): void {
        this.on<string>(connection.id, 'leave_chat', async (conn, chatId) => {
            if (!conn.user) return;

            try {
                await this.leaveRoom(conn.id, `chat-${chatId}`);
                this.emitToSocket(conn.id, 'left_chat', { chatId });

                logger.info(`@chat-socket - user ${conn.user._id} left chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - leave_chat error: ${error}`);
            }
        });
    }

    /**
     * Send a message
     */
    private registerSendMessage(connection: ISocketConnection): void {
        this.on<SendMessagePayload>(connection.id, 'send_message', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId, content, messageType = 'text', metadata } = data;

                const hasAccess = await this.checkChatAccess(conn.user._id, chatId);
                if (!hasAccess) {
                    this.emitToSocket(conn.id, 'error', 'Chat not found or access denied');
                    return;
                }

                const result = await this.sendChatMessageUseCase.execute({
                    userId: conn.user._id,
                    chatId,
                    content,
                    messageType: messageType as any,
                    metadata
                });

                if (!result.success) {
                    this.emitToSocket(conn.id, 'error', result.error?.message || 'Failed to send message');
                    return;
                }

                // Broadcast to all users in the chat room
                this.emitToRoom(`chat-${chatId}`, 'new_message', {
                    message: result.value,
                    chatId
                });

                logger.info(`@chat-socket - message sent in chat ${chatId} by ${conn.user._id}`);
            } catch (error) {
                logger.error(`@chat-socket - send_message error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to send message');
            }
        });
    }

    /**
     * Send a file message
     */
    private registerSendFileMessage(connection: ISocketConnection): void {
        this.on<SendFileMessagePayload>(connection.id, 'send_file_message', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId, filename, originalName, size, mimetype, url } = data;

                const hasAccess = await this.checkChatAccess(conn.user._id, chatId);
                if (!hasAccess) {
                    this.emitToSocket(conn.id, 'error', 'Chat not found or access denied');
                    return;
                }

                const result = await this.sendFileMessageUseCase.execute({
                    userId: conn.user._id,
                    chatId,
                    fileData: {
                        filename,
                        originalName,
                        size,
                        mimetype,
                        url
                    }
                });

                if (!result.success) {
                    this.emitToSocket(conn.id, 'error', result.error?.message || 'Failed to send file message');
                    return;
                }

                this.emitToRoom(`chat-${chatId}`, 'new_message', {
                    message: result.value,
                    chatId
                });

                logger.info(`@chat-socket - file message sent in chat ${chatId} by ${conn.user._id}`);
            } catch (error) {
                logger.error(`@chat-socket - send_file_message error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to send file message');
            }
        });
    }

    /**
     * Edit a message
     */
    private registerEditMessage(connection: ISocketConnection): void {
        this.on<EditMessagePayload>(connection.id, 'edit_message', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId, messageId, content } = data;

                const result = await this.editMessageUseCase.execute({
                    messageId,
                    userId: conn.user._id,
                    content
                });

                if (!result.success) {
                    this.emitToSocket(conn.id, 'error', result.error?.message || 'Failed to edit message');
                    return;
                }

                this.emitToRoom(`chat-${chatId}`, 'message_edited', {
                    chatId,
                    message: result.value
                });

                logger.info(`@chat-socket - message ${messageId} edited in chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - edit_message error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to edit message');
            }
        });
    }

    /**
     * Delete a message
     */
    private registerDeleteMessage(connection: ISocketConnection): void {
        this.on<DeleteMessagePayload>(connection.id, 'delete_message', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId, messageId } = data;

                const result = await this.deleteMessageUseCase.execute({
                    messageId,
                    userId: conn.user._id
                });

                if (!result.success) {
                    this.emitToSocket(conn.id, 'error', result.error?.message || 'Failed to delete message');
                    return;
                }

                this.emitToRoom(`chat-${chatId}`, 'message_deleted', {
                    chatId,
                    messageId
                });

                logger.info(`@chat-socket - message ${messageId} deleted in chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - delete_message error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to delete message');
            }
        });
    }

    /**
     * Toggle reaction on a message
     */
    private registerToggleReaction(connection: ISocketConnection): void {
        this.on<ToggleReactionPayload>(connection.id, 'toggle_reaction', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId, messageId, emoji } = data;

                const result = await this.toggleMessageReactionUseCase.execute({
                    messageId,
                    userId: conn.user._id,
                    emoji
                });

                if (!result.success) {
                    logger.error(`@chat-socket - toggle_reaction failed: ${result.error?.message}`);
                    return;
                }

                this.emitToRoom(`chat-${chatId}`, 'reaction_updated', {
                    chatId,
                    message: result.value
                });
            } catch (error) {
                logger.error(`@chat-socket - toggle_reaction error: ${error}`);
            }
        });
    }

    /**
     * Mark messages as read
     */
    private registerMarkRead(connection: ISocketConnection): void {
        this.on<MarkReadPayload>(connection.id, 'mark_read', async (conn, data) => {
            if (!conn.user) return;

            try {
                const { chatId } = data;

                const hasAccess = await this.checkChatAccess(conn.user._id, chatId);
                if (!hasAccess) return;

                await this.markMessagesAsReadUseCase.execute({
                    chatId,
                    userId: conn.user._id
                });

                this.emitToRoom(`chat-${chatId}`, 'messages_read', {
                    chatId,
                    readBy: conn.user._id,
                    readAt: new Date()
                });
            } catch (error) {
                logger.error(`@chat-socket - mark_read error: ${error}`);
                this.emitToSocket(conn.id, 'error', 'Failed to mark messages as read');
            }
        });
    }

    /**
     * User started typing
     */
    private registerTypingStart(connection: ISocketConnection): void {
        this.on<TypingPayload>(connection.id, 'typing_start', (conn, data) => {
            if (!conn.user) return;

            const { chatId } = data;

            // Emit to everyone in the room except the sender
            this.emitToRoomExcept(conn.id, `chat-${chatId}`, 'user_typing', {
                chatId,
                userId: conn.user._id,
                userName: `${conn.user.firstName} ${conn.user.lastName}`,
                isTyping: true
            });
        });
    }

    /**
     * User stopped typing
     */
    private registerTypingStop(connection: ISocketConnection): void {
        this.on<TypingPayload>(connection.id, 'typing_stop', (conn, data) => {
            if (!conn.user) return;

            const { chatId } = data;

            this.emitToRoomExcept(conn.id, `chat-${chatId}`, 'user_typing', {
                chatId,
                userId: conn.user._id,
                userName: `${conn.user.firstName} ${conn.user.lastName}`,
                isTyping: false
            });
        });
    }

    /**
     * Get users presence (online/offline)
     */
    private registerGetUsersPresence(connection: ISocketConnection): void {
        this.on<GetUsersPresencePayload>(connection.id, 'get_users_presence', (conn, data) => {
            if (!conn.user) return;

            const { userIds } = data;
            const presence: Record<string, 'online' | 'offline'> = {};

            // Build presence map based on tracked online users
            const onlineUserIds = new Set(this.onlineUsers.values());

            for (const userId of userIds) {
                presence[userId] = onlineUserIds.has(userId) ? 'online' : 'offline';
            }

            this.emitToSocket(conn.id, 'users_presence_info', presence);
        });
    }

    /**
     * Register group-related events
     */
    private registerGroupEvents(connection: ISocketConnection): void {
        // Group created
        this.on<{ chatId: string }>(connection.id, 'group_created', (conn, data) => {
            if (!conn.user) return;

            this.emitToRoom(`chat-${data.chatId}`, 'group_created', {
                chatId: data.chatId,
                createdBy: conn.user._id
            });
        });

        // Users added to group
        this.on<GroupUsersPayload>(connection.id, 'users_added_to_group', (conn, data) => {
            if (!conn.user) return;

            this.emitToRoom(`chat-${data.chatId}`, 'users_added_to_group', {
                chatId: data.chatId,
                userIds: data.userIds,
                addedBy: conn.user._id
            });
        });

        // Users removed from group
        this.on<GroupUsersPayload>(connection.id, 'users_removed_from_group', (conn, data) => {
            if (!conn.user) return;

            this.emitToRoom(`chat-${data.chatId}`, 'users_removed_from_group', {
                chatId: data.chatId,
                userIds: data.userIds,
                removedBy: conn.user._id
            });
        });

        // Group info updated
        this.on<GroupInfoPayload>(connection.id, 'group_info_updated', (conn, data) => {
            if (!conn.user) return;

            this.emitToRoom(`chat-${data.chatId}`, 'group_info_updated', {
                chatId: data.chatId,
                groupName: data.groupName,
                groupDescription: data.groupDescription,
                updatedBy: conn.user._id
            });
        });

        // User left group
        this.on<UserLeftGroupPayload>(connection.id, 'user_left_group', (conn, data) => {
            if (!conn.user) return;

            this.emitToRoom(`chat-${data.chatId}`, 'user_left_group', {
                chatId: data.chatId,
                userId: data.userId
            });
        });
    }

    /**
     * Check if user has access to a chat
     */
    private async checkChatAccess(userId: string, chatId: string): Promise<boolean> {
        try {
            const chat = await this.chatRepository.findById(chatId);
            if (!chat) return false;

            // Check if user is a participant
            const participants = chat.props.participants || [];
            return participants.some((p: any) => {
                const participantId = typeof p === 'string' ? p : p._id?.toString() || p.toString();
                return participantId === userId;
            });
        } catch (error) {
            logger.error(`@chat-socket - checkChatAccess error: ${error}`);
            return false;
        }
    }
}
