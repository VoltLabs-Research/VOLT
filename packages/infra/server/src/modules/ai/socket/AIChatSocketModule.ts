import typia from 'typia';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { ackError, ackOk } from '@modules/socket/socket/socket-ack';
import type { SocketAck } from '@modules/socket/socket/socket-ack';
import conversationService from '@modules/ai/services/ConversationService';
import chatPresence from '@modules/ai/services/chat/ChatPresence';
import chatStreamService, { type PreparedTurn } from '@modules/ai/services/chat/ChatStreamService';
import { TURN_FAILED } from '@modules/ai/services/chat/ChatTurnEngine';
import type { ChatFrame } from '@modules/ai/contracts/chat';
import { AI_CHAT_EVENTS, aiConversationRoom } from '@volt/contracts/modules/ai/socket';
import type { ChatChunkFrame, ChatJoined, ChatJoinPayload, ChatLeavePayload, ChatSavedFrame, ChatStopPayload, ChatTurnPayload } from '@volt/contracts/modules/ai/socket';
import ApplicationError from '@shared/errors/ApplicationError';
import logger from '@shared/logger';
import { ErrorCodes } from '@core/constants/error-codes';

const READ_PERMISSION = 'ai-conversation:read';

const isJoinPayload = typia.createIs<ChatJoinPayload>();
const isLeavePayload = typia.createIs<ChatLeavePayload>();
const isStopPayload = typia.createIs<ChatStopPayload>();
const isTurnPayload = typia.createIs<ChatTurnPayload>();

const asksSomething = (payload: ChatTurnPayload): boolean =>
    payload.message !== undefined || (payload.approvals?.length ?? 0) > 0;

const codeOf = (error: unknown): string => {
    if (error instanceof ApplicationError) return error.code;

    logger.error(`@ai-chat-socket: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    return ErrorCodes.INTERNAL_SERVER_ERROR;
};

const userOf = (connection: ISocketConnection): string | undefined => connection.user?._id ?? connection.userId;

class AIChatSocketModule extends BaseSocketModule {
    public readonly name = 'AIChatSocketModule';

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<unknown, SocketAck<ChatJoined>>(connection.id, AI_CHAT_EVENTS.join, (conn, payload) => this.#join(conn, payload));
        this.on<unknown, SocketAck>(connection.id, AI_CHAT_EVENTS.leave, (conn, payload) => this.#leave(conn, payload));
        this.on<unknown, SocketAck>(connection.id, AI_CHAT_EVENTS.send, (conn, payload) => this.#send(conn, payload));
        this.on<unknown, SocketAck>(connection.id, AI_CHAT_EVENTS.stop, (conn, payload) => this.#stop(conn, payload));
        this.onDisconnect(connection.id, (conn) => {
            chatPresence.drop(conn.id);
        });
    }

    async #join(connection: ISocketConnection, payload: unknown): Promise<SocketAck<ChatJoined>> {
        try {
            const userId = userOf(connection);
            if (!userId) return ackError(ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
            if (!isJoinPayload(payload)) return ackError(ErrorCodes.AI_TURN_MALFORMED);

            const conversation = await conversationService.ownedBy(userId, payload.conversationId);
            const permissions = await chatStreamService.permissionsOf(conversation);
            if (!permissions.includes('*') && !permissions.includes(READ_PERMISSION)) {
                return ackError(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS);
            }

            await this.joinRoom(connection.id, aiConversationRoom(conversation.id));
            chatPresence.join(connection.id, conversation.id);

            for (const chunk of chatStreamService.replay(conversation.id)) {
                const frame: ChatChunkFrame = {
                    conversationId: conversation.id,
                    chunk
                };
                this.emitToSocket(connection.id, AI_CHAT_EVENTS.chunk, frame);
            }

            return ackOk({
                conversationId: conversation.id,
                live: chatStreamService.isLive(conversation.id)
            });
        } catch (error: unknown) {
            return ackError(codeOf(error));
        }
    }

    async #leave(connection: ISocketConnection, payload: unknown): Promise<SocketAck> {
        if (!isLeavePayload(payload)) return ackError(ErrorCodes.AI_TURN_MALFORMED);

        chatPresence.leave(connection.id, payload.conversationId);
        await this.leaveRoom(connection.id, aiConversationRoom(payload.conversationId));

        return ackOk();
    }

    async #send(connection: ISocketConnection, payload: unknown): Promise<SocketAck> {
        try {
            const userId = userOf(connection);
            if (!userId) return ackError(ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
            if (!isTurnPayload(payload) || !asksSomething(payload)) return ackError(ErrorCodes.AI_TURN_MALFORMED);
            if (!chatPresence.isJoined(connection.id, payload.conversationId)) return ackError(ErrorCodes.AI_CONVERSATION_NOT_JOINED);

            const prepared = await chatStreamService.prepare(userId, payload, connection.id);
            void this.#run(prepared, payload);

            return ackOk();
        } catch (error: unknown) {
            return ackError(codeOf(error));
        }
    }

    #stop(connection: ISocketConnection, payload: unknown): SocketAck {
        if (!isStopPayload(payload)) return ackError(ErrorCodes.AI_TURN_MALFORMED);
        if (!chatPresence.isJoined(connection.id, payload.conversationId)) return ackError(ErrorCodes.AI_CONVERSATION_NOT_JOINED);

        chatStreamService.stop(payload.conversationId);
        return ackOk();
    }

    async #run(prepared: PreparedTurn, payload: ChatTurnPayload): Promise<void> {
        const conversationId = prepared.conversation.id;

        try {
            for await (const frame of chatStreamService.respond(prepared, payload)) this.#broadcast(conversationId, frame);
        } catch (error: unknown) {
            logger.error(`@ai-chat-socket: turn of conversation ${conversationId} broke: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
            this.#broadcast(conversationId, {
                type: 'chunk',
                chunk: {
                    type: 'error',
                    errorText: TURN_FAILED
                }
            });
            this.#broadcast(conversationId, {
                type: 'chunk',
                chunk: { type: 'finish' }
            });
        }
    }

    #broadcast(conversationId: string, frame: ChatFrame): void {
        const room = aiConversationRoom(conversationId);

        if (frame.type === 'chunk') {
            const chunkFrame: ChatChunkFrame = {
                conversationId,
                chunk: frame.chunk
            };
            this.emitToRoom(room, AI_CHAT_EVENTS.chunk, chunkFrame);
            return;
        }

        const savedFrame: ChatSavedFrame = {
            conversationId,
            message: frame.message
        };
        this.emitToRoom(room, AI_CHAT_EVENTS.saved, savedFrame);
    }
}

export default new AIChatSocketModule();
