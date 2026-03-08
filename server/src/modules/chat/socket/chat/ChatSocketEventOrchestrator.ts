import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';
import { EditMessageUseCase } from '@modules/chat/application/use-cases/chat-message/EditMessageUseCase';
import { MarkMessageAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';
import { ToggleMessageReactionUseCase } from '@modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';
import { ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { createSocketErrorEnvelope, createSocketErrorEnvelopeFromApplicationError } from '@modules/socket/utilities/socket-error-envelope';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import ChatSocketAccessPolicy from './ChatSocketAccessPolicy';
import ChatSocketPresenceService from './ChatSocketPresenceService';
import { inject, injectable } from 'tsyringe';
import type { ErrorCode } from '@core/constants/error-codes';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type {
    DeleteMessagePayload,
    EditMessagePayload,
    GetUsersPresencePayload,
    MarkReadPayload,
    SendMessagePayload,
    ToggleReactionPayload,
    TypingPayload
} from './ChatSocketPayloads';

@injectable()
export default class ChatSocketEventOrchestrator {
    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly emitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        private readonly roomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        private readonly eventRegistry: ISocketEventRegistry,

        @inject(CHAT_TOKENS.ChatSocketAccessPolicy)
        private readonly accessPolicy: ChatSocketAccessPolicy,

        @inject(CHAT_TOKENS.ChatSocketPresenceService)
        private readonly presenceService: ChatSocketPresenceService,

        private readonly sendChatMessageUseCase: SendChatMessageUseCase,

        private readonly editMessageUseCase: EditMessageUseCase,

        private readonly deleteMessageUseCase: DeleteMessageUseCase,

        private readonly toggleMessageReactionUseCase: ToggleMessageReactionUseCase,

        private readonly markMessageAsReadUseCase: MarkMessageAsReadUseCase
    ) {}

    register(connection: ISocketConnection): void {
        this.registerJoinChat(connection);
        this.registerLeaveChat(connection);
        this.registerSendMessage(connection);
        this.registerEditMessage(connection);
        this.registerDeleteMessage(connection);
        this.registerToggleReaction(connection);
        this.registerMarkRead(connection);
        this.registerTypingStart(connection);
        this.registerTypingStop(connection);
        this.registerGetUsersPresence(connection);
    }

    private registerJoinChat(connection: ISocketConnection): void {
        this.eventRegistry.on<string>(connection.id, 'join_chat', async (conn, chatId) => {
            if (!conn.user) {
                return;
            }

            try {
                const chatAccessError = await this.accessPolicy.validate(conn.user._id, chatId);
                if (chatAccessError) {
                    this.emitApplicationError(conn.id, chatAccessError);
                    return;
                }

                await this.roomManager.join(conn.id, this.getChatRoom(chatId));
                this.emitter.emitToSocket(conn.id, 'joined_chat', { chatId });

                logger.info(`@chat-socket - user ${conn.user._id} joined chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - join_chat error: ${error}`);
                this.emitSocketError(conn.id, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to join chat');
            }
        });
    }

    private registerLeaveChat(connection: ISocketConnection): void {
        this.eventRegistry.on<string>(connection.id, 'leave_chat', async (conn, chatId) => {
            if (!conn.user) {
                return;
            }

            try {
                await this.roomManager.leave(conn.id, this.getChatRoom(chatId));
                this.emitter.emitToSocket(conn.id, 'left_chat', { chatId });

                logger.info(`@chat-socket - user ${conn.user._id} left chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - leave_chat error: ${error}`);
            }
        });
    }

    private registerSendMessage(connection: ISocketConnection): void {
        this.eventRegistry.on<SendMessagePayload>(connection.id, 'send_message', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            try {
                const { chatId, content, messageType = ChatMessageType.Text, metadata } = data;
                const chatAccessError = await this.accessPolicy.validate(conn.user._id, chatId);

                if (chatAccessError) {
                    this.emitApplicationError(conn.id, chatAccessError);
                    return;
                }

                const result = await this.sendChatMessageUseCase.execute({
                    userId: conn.user._id,
                    chatId,
                    content,
                    messageType,
                    metadata
                });

                if (!result.success) {
                    this.emitUseCaseFailure(conn.id, result.error, 'Failed to send message');
                    return;
                }

                logger.info(`@chat-socket - message sent in chat ${chatId} by ${conn.user._id}`);
            } catch (error) {
                logger.error(`@chat-socket - send_message error: ${error}`);
                this.emitSocketError(conn.id, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to send message');
            }
        });
    }

    private registerEditMessage(connection: ISocketConnection): void {
        this.eventRegistry.on<EditMessagePayload>(connection.id, 'edit_message', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            try {
                const { chatId, messageId, content } = data;
                const result = await this.editMessageUseCase.execute({
                    chatId,
                    messageId,
                    userId: conn.user._id,
                    content
                });

                if (!result.success) {
                    this.emitUseCaseFailure(conn.id, result.error, 'Failed to edit message');
                    return;
                }

                logger.info(`@chat-socket - message ${messageId} edited in chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - edit_message error: ${error}`);
                this.emitSocketError(conn.id, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to edit message');
            }
        });
    }

    private registerDeleteMessage(connection: ISocketConnection): void {
        this.eventRegistry.on<DeleteMessagePayload>(connection.id, 'delete_message', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            try {
                const { chatId, messageId } = data;
                const result = await this.deleteMessageUseCase.execute({
                    chatId,
                    messageId,
                    userId: conn.user._id
                });

                if (!result.success) {
                    this.emitUseCaseFailure(conn.id, result.error, 'Failed to delete message');
                    return;
                }

                logger.info(`@chat-socket - message ${messageId} deleted in chat ${chatId}`);
            } catch (error) {
                logger.error(`@chat-socket - delete_message error: ${error}`);
                this.emitSocketError(conn.id, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete message');
            }
        });
    }

    private registerToggleReaction(connection: ISocketConnection): void {
        this.eventRegistry.on<ToggleReactionPayload>(connection.id, 'toggle_reaction', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            try {
                const { chatId, messageId, emoji } = data;
                const result = await this.toggleMessageReactionUseCase.execute({
                    chatId,
                    messageId,
                    userId: conn.user._id,
                    emoji
                });

                if (!result.success) {
                    logger.error(`@chat-socket - toggle_reaction failed: ${result.error?.message}`);
                }
            } catch (error) {
                logger.error(`@chat-socket - toggle_reaction error: ${error}`);
            }
        });
    }

    private registerMarkRead(connection: ISocketConnection): void {
        this.eventRegistry.on<MarkReadPayload>(connection.id, 'mark_read', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            try {
                const { chatId } = data;
                const chatAccessError = await this.accessPolicy.validate(conn.user._id, chatId);

                if (chatAccessError) {
                    return;
                }

                const result = await this.markMessageAsReadUseCase.execute({
                    chatId,
                    userId: conn.user._id
                });

                if (!result.success) {
                    this.emitUseCaseFailure(conn.id, result.error, 'Failed to mark messages as read');
                }
            } catch (error) {
                logger.error(`@chat-socket - mark_read error: ${error}`);
                this.emitSocketError(conn.id, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to mark messages as read');
            }
        });
    }

    private registerTypingStart(connection: ISocketConnection): void {
        this.eventRegistry.on<TypingPayload>(connection.id, 'typing_start', (conn, data) => {
            if (!conn.user) {
                return;
            }

            this.emitter.emitToRoomExcept(conn.id, this.getChatRoom(data.chatId), 'user_typing', {
                chatId: data.chatId,
                userId: conn.user._id,
                userName: `${conn.user.firstName} ${conn.user.lastName}`,
                isTyping: true
            });
        });
    }

    private registerTypingStop(connection: ISocketConnection): void {
        this.eventRegistry.on<TypingPayload>(connection.id, 'typing_stop', (conn, data) => {
            if (!conn.user) {
                return;
            }

            this.emitter.emitToRoomExcept(conn.id, this.getChatRoom(data.chatId), 'user_typing', {
                chatId: data.chatId,
                userId: conn.user._id,
                userName: `${conn.user.firstName} ${conn.user.lastName}`,
                isTyping: false
            });
        });
    }

    private registerGetUsersPresence(connection: ISocketConnection): void {
        this.eventRegistry.on<GetUsersPresencePayload>(connection.id, 'get_users_presence', async (conn, data) => {
            if (!conn.user) {
                return;
            }

            const presence = await this.presenceService.getUsersPresence(data.userIds);
            this.emitter.emitToSocket(conn.id, 'users_presence_info', presence);
        });
    }

    private getChatRoom(chatId: string): string {
        return `chat-${chatId}`;
    }

    private emitUseCaseFailure(socketId: string, error: ApplicationError | undefined, fallbackMessage: string): void {
        if (error) {
            this.emitApplicationError(socketId, error);
            return;
        }

        this.emitSocketError(socketId, ErrorCodes.INTERNAL_SERVER_ERROR, fallbackMessage);
    }

    private emitSocketError(socketId: string, code: ErrorCode, details?: string): void {
        this.emitter.emitToSocket(socketId, 'error', createSocketErrorEnvelope(code, details));
    }

    private emitApplicationError(socketId: string, error: ApplicationError): void {
        this.emitter.emitToSocket(socketId, 'error', createSocketErrorEnvelopeFromApplicationError(error));
    }
};
