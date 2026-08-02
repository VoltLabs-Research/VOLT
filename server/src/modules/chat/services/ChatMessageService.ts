import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import { resolveAccessibleChat } from '@modules/chat/services/chat-access';
import { clearReaction, setReaction } from '@modules/chat/services/chat-reactions';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageMetadata } from '@volt/contracts/modules/chat/domain';
import type { ChatFileUpload, ChatReactionProps } from '@modules/chat/contracts/chat-message';
import type { SendChatMessageInput } from '@volt/contracts/modules/chat/http';

const MESSAGES_DEFAULT_LIMIT = 100;

export default class ChatMessageService{
    async getChatMessages(userId: string, chatId: string, query: { page?: number; limit?: number }){
        await resolveAccessibleChat(chatId, userId);

        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: MESSAGES_DEFAULT_LIMIT });
        const [messages, total] = await ChatMessage.findAndCount({
            where: { chat: chatId },
            order: { createdAt: 'ASC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest),
            relations: { senderRef: true }
        });

        return paginate([messages.map((message) => message.toJSON()), total], pageRequest);
    }

    sendChatMessage(userId: string, chatId: string, input: SendChatMessageInput){
        return this.#createMessage(userId, chatId, input);
    }

    sendFileMessage(userId: string, chatId: string, fileData: ChatFileUpload){
        return this.#createMessage(userId, chatId, {
            content: fileData.originalName,
            messageType: ChatMessageType.File,
            metadata: {
                fileName: fileData.originalName,
                fileSize: fileData.size,
                fileType: fileData.mimetype,
                fileUrl: fileData.url,
                filePath: fileData.filename
            }
        });
    }

    async editMessage(userId: string, chatId: string, messageId: string, content: string){
        const message = await this.#requireOwnMessage(messageId, userId);
        message.content = content;
        await message.save();

        return this.#publish(chatId, messageId, 'message_edited');
    }

    async deleteMessage(userId: string, chatId: string, messageId: string): Promise<void>{
        await this.#requireOwnMessage(messageId, userId);

        await ChatMessage.update({ id: messageId }, { deleted: true });
        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'message_deleted', {
            chatId,
            messageId
        });
    }

    async markMessagesAsRead(userId: string, chatId: string): Promise<void>{
        await resolveAccessibleChat(chatId, userId);

        const messages = await ChatMessage.findBy({ chat: chatId });
        const unread = messages.filter((message) => !(message.readBy ?? []).includes(userId));
        for(const message of unread){
            message.readBy = [...(message.readBy ?? []), userId];
        }
        if(unread.length > 0){
            await ChatMessage.save(unread);
        }

        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'messages_read', {
            chatId,
            readBy: userId,
            readAt: new Date()
        });
    }

    setMessageReaction(userId: string, chatId: string, messageId: string, emoji: string){
        return this.#applyReaction(userId, chatId, messageId, (reactions) => setReaction(reactions, userId, emoji));
    }

    removeMessageReaction(userId: string, chatId: string, messageId: string, emoji: string){
        return this.#applyReaction(userId, chatId, messageId, (reactions) => clearReaction(reactions, userId, emoji));
    }

    async #createMessage(
        userId: string,
        chatId: string,
        payload: { content: string; messageType: ChatMessageType; metadata?: ChatMessageMetadata }
    ){
        await resolveAccessibleChat(chatId, userId);

        const created = await ChatMessage.create({
            chat: chatId,
            sender: userId,
            content: payload.content,
            messageType: payload.messageType,
            metadata: payload.metadata,
            readBy: [userId],
            reactions: [],
            deleted: false
        }).save();

        await Chat.update({ id: chatId }, {
            lastMessage: created.id,
            lastMessageAt: new Date()
        });

        return this.#publish(chatId, created.id, 'new_message');
    }

    async #applyReaction(
        userId: string,
        chatId: string,
        messageId: string,
        apply: (reactions: ChatReactionProps[]) => ChatReactionProps[]
    ){
        const message = await this.#findMessage(messageId);
        await resolveAccessibleChat(message.chat, userId);

        message.reactions = apply(message.reactions);
        await message.save();

        return this.#publish(chatId, messageId, 'reaction_updated');
    }

    async #findMessage(messageId: string): Promise<ChatMessage>{
        const message = await ChatMessage.findOneBy({ id: messageId });
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }
        return message;
    }

    async #requireOwnMessage(messageId: string, userId: string): Promise<ChatMessage>{
        const message = await this.#findMessage(messageId);
        if(message.sender !== userId){
            throw ApplicationError.forbidden(ErrorCodes.MESSAGE_FORBIDDEN, 'Not owner');
        }
        return message;
    }

    /** Reloads the message with its sender relation, fans it out to the room and returns the wire view. */
    async #publish(chatId: string, messageId: string, event: string){
        const message = await ChatMessage.findOne({
            where: { id: messageId },
            relations: { senderRef: true }
        });
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        const view = message.toJSON();
        socketIOEmitter.emitToRoom(`chat-${chatId}`, event, {
            chatId,
            message: view
        });
        return view;
    }
}
