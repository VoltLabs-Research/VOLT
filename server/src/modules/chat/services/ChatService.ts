import { ErrorCodes } from '@core/constants/error-codes';
import ChatModel from '@modules/chat/models/chat/ChatModel';
import type { ChatDocument } from '@modules/chat/models/chat/ChatModel';
import ChatMessageModel from '@modules/chat/models/chat-message/ChatMessageModel';
import { ChatMessageType } from '@modules/chat/models/chat-message/ChatMessageModel';
import type { ChatMessageDocument, ChatMessageMetadata } from '@modules/chat/models/chat-message/ChatMessageModel';
import ChatDeletedEvent from '@modules/chat/events/ChatDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import logger from '@shared/infrastructure/logger';
import type { HydratedDocument } from 'mongoose';
import { container as diContainer } from 'tsyringe';
import type {
    CreateGroupChatInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput,
    SendChatMessageInput
} from '@volt/contracts/modules/chat/http';

type ChatDoc = HydratedDocument<ChatDocument>;
type ChatView = Record<string, unknown>;

interface ChatMessagesQuery {
    page?: number;
    limit?: number;
}

interface ChatFileData {
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
}

const stripPersisted = (obj: Record<string, unknown>): ChatView => {
    const { __v: _ignored, _id, ...rest } = obj;
    return { _id: String(_id), ...rest };
};

const toPersisted = (doc: { toObject(): Record<string, unknown> }): ChatView =>
    stripPersisted(doc.toObject());

const toParticipantId = (participant: unknown): string => {
    if (typeof participant === 'string') {
        return participant;
    }
    if (participant && typeof participant === 'object' && '_id' in participant && (participant as { _id?: unknown })._id) {
        return String((participant as { _id: unknown })._id);
    }
    return String(participant);
};

export default class ChatService {
    #socketEmitter = socketIOEmitter;

    #teamMemberRepoCache?: ITeamMemberRepository;
    get #teamMemberRepo(): ITeamMemberRepository {
        return (this.#teamMemberRepoCache ??= diContainer.resolve<ITeamMemberRepository>(TEAM_CONTRACT_TOKENS.TeamMemberRepository));
    }

    #teamRepoCache?: ITeamRepository;
    get #teamRepo(): ITeamRepository {
        return (this.#teamRepoCache ??= diContainer.resolve<ITeamRepository>(TEAM_CONTRACT_TOKENS.TeamRepository));
    }

    #eventBusCache?: IEventBus;
    get #eventBus(): IEventBus {
        return (this.#eventBusCache ??= diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus));
    }

    async getUserChats(userId: string): Promise<ChatView[]> {
        const chats = await ChatModel.find({ participants: userId, isActive: true })
            .populate('lastMessage')
            .populate('participants')
            .sort({ lastMessageAt: -1 })
            .exec();
        return chats.map((chat) => toPersisted(chat));
    }

    async getOrCreateChat(userId: string, targetUserId: string, teamId: string): Promise<ChatView> {
        if (userId === targetUserId) {
            throw ApplicationError.badRequest(ErrorCodes.CHAT_INVALID_ACTION, 'Cannot create chat with yourself');
        }

        let chat = await ChatModel.findOne({
            participants: { $all: [userId, targetUserId] },
            team: teamId,
            isGroup: false
        });

        if (!chat) {
            chat = await ChatModel.create({
                participants: [userId, targetUserId],
                team: teamId,
                isActive: true,
                isGroup: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await chat.populate('participants');
        return toPersisted(chat);
    }

    async createGroupChat(userId: string, input: CreateGroupChatInput): Promise<ChatView> {
        const { teamId, participantIds, groupName, groupDescription } = input;

        const team = await this.#teamRepo.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const allUserIds = [...new Set([userId, ...participantIds])];
        await this.#ensureTeamMembersExist(teamId, allUserIds);

        const chat = await ChatModel.create({
            participants: allUserIds,
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription,
            admins: [userId],
            createdBy: userId,
            isActive: true
        });

        for (const participantId of allUserIds) {
            this.#socketEmitter.emitToRoom(`user-${participantId}`, 'group_created', {
                chatId: String(chat._id),
                createdBy: userId
            });
        }

        return toPersisted(chat);
    }

    async addUsersToGroup(userId: string, chatId: string, userIds: string[]): Promise<ChatView> {
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const teamId = String(chat.team);
        await this.#ensureTeamMembersExist(teamId, userIds);

        const newParticipants = new Set([...this.#participantIds(chat), ...userIds]);
        const updatedChat = await this.#updateChat(chatId, { participants: Array.from(newParticipants) });

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'users_added_to_group', {
            chatId,
            userIds,
            addedBy: userId
        });

        return toPersisted(updatedChat);
    }

    async removeUsersFromGroup(userId: string, chatId: string, userIds: string[]): Promise<ChatView> {
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const newParticipants = this.#participantIds(chat).filter((participant) => !userIds.includes(participant));
        if (newParticipants.length < 2) {
            throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS, 'The group must have at least 2 members');
        }

        const newAdmins = this.#adminIds(chat).filter((admin) => !userIds.includes(admin));
        const updatedChat = await this.#updateChat(chatId, { participants: newParticipants, admins: newAdmins });

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'users_removed_from_group', {
            chatId,
            userIds,
            removedBy: userId
        });

        return toPersisted(updatedChat);
    }

    async updateGroupInfo(userId: string, chatId: string, input: UpdateGroupInfoInput): Promise<ChatView> {
        await this.#resolveGroupChat(chatId, userId, true);

        const updateData: Record<string, unknown> = {};
        if (input.groupName) updateData.groupName = input.groupName;
        if (input.groupDescription) updateData.groupDescription = input.groupDescription;

        const updatedChat = await this.#updateChat(chatId, updateData);

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'group_info_updated', {
            chatId,
            groupName: input.groupName,
            groupDescription: input.groupDescription,
            updatedBy: userId
        });

        return toPersisted(updatedChat);
    }

    async updateGroupAdmins(userId: string, chatId: string, input: UpdateGroupAdminsInput): Promise<ChatView> {
        const { action, targetUserIds } = input;
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const participantIds = this.#participantIds(chat);
        const validUsers = targetUserIds.filter((id) => participantIds.includes(id));
        if (validUsers.length !== targetUserIds.length) {
            throw ApplicationError.badRequest(ErrorCodes.CHAT_USERS_NOT_IN_TEAM, 'Users not in team');
        }

        let updatedAdmins = [...this.#adminIds(chat)];
        if (action === 'add') {
            updatedAdmins = [...new Set([...updatedAdmins, ...validUsers])];
        } else if (action === 'remove') {
            updatedAdmins = updatedAdmins.filter((admin) => !validUsers.includes(admin));
            if (updatedAdmins.length === 0) {
                throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_ADMINS, 'At least 1 admin is required');
            }
        } else {
            throw ApplicationError.badRequest(ErrorCodes.CHAT_INVALID_ACTION, 'Invalid group admin action');
        }

        const updatedChat = await this.#updateChat(chatId, { admins: updatedAdmins });
        return toPersisted(updatedChat);
    }

    async leaveGroup(userId: string, chatId: string): Promise<void> {
        const chat = await this.#resolveGroupChat(chatId, userId, false);

        const newParticipants = this.#participantIds(chat).filter((participant) => participant !== userId);
        let newAdmins = this.#adminIds(chat).filter((admin) => admin !== userId);

        const createdBy = chat.createdBy ? String(chat.createdBy) : undefined;
        if (newAdmins.length === 0 && createdBy) {
            newAdmins = [createdBy];
        }

        const isActive = newParticipants.length >= 2;
        await this.#updateChat(chatId, { participants: newParticipants, admins: newAdmins, isActive });

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'user_left_group', { chatId, userId });
    }

    async getChatMessages(userId: string, chatId: string, query: ChatMessagesQuery): Promise<PaginatedResult<ChatView>> {
        await this.#resolveAccessibleChat(chatId, userId);

        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 100;

        const filter = { chat: chatId };
        const [docs, total] = await Promise.all([
            ChatMessageModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ createdAt: 1 })
                .populate('sender')
                .exec(),
            ChatMessageModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => toPersisted(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async sendChatMessage(userId: string, chatId: string, input: SendChatMessageInput): Promise<ChatView> {
        return this.#createMessage(userId, chatId, {
            content: input.content,
            messageType: input.messageType as ChatMessageType,
            metadata: input.metadata
        });
    }

    async sendFileMessage(userId: string, chatId: string, fileData: ChatFileData): Promise<ChatView> {
        const metadata: ChatMessageMetadata = {
            fileName: fileData.originalName,
            fileSize: fileData.size,
            fileType: fileData.mimetype,
            fileUrl: fileData.url,
            filePath: fileData.filename
        };

        return this.#createMessage(userId, chatId, {
            content: fileData.originalName,
            messageType: ChatMessageType.File,
            metadata
        });
    }

    async editMessage(userId: string, chatId: string, messageId: string, content: string): Promise<ChatView> {
        const message = await ChatMessageModel.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }
        if (!this.#isSender(message, userId)) {
            throw ApplicationError.forbidden(ErrorCodes.MESSAGE_FORBIDDEN, 'Not owner');
        }

        const updatedMessage = await ChatMessageModel.findByIdAndUpdate(
            messageId,
            { $set: { content } },
            { new: true }
        ).populate('sender');
        if (!updatedMessage) {
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        const persistedMessage = toPersisted(updatedMessage);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'message_edited', { chatId, message: persistedMessage });
        return persistedMessage;
    }

    async deleteMessage(userId: string, chatId: string, messageId: string): Promise<void> {
        const message = await ChatMessageModel.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }
        if (!this.#isSender(message, userId)) {
            throw ApplicationError.forbidden(ErrorCodes.MESSAGE_FORBIDDEN, 'Not owner');
        }

        await ChatMessageModel.updateOne({ _id: messageId }, { $set: { deleted: true } });
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'message_deleted', { chatId, messageId });
    }

    async markMessagesAsRead(userId: string, chatId: string): Promise<void> {
        await this.#resolveAccessibleChat(chatId, userId);

        await ChatMessageModel.updateMany(
            { chat: chatId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'messages_read', { chatId, readBy: userId, readAt: new Date() });
    }

    async toggleMessageReaction(userId: string, chatId: string, messageId: string, emoji: string): Promise<ChatView> {
        const message = await ChatMessageModel.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Message not found');
        }

        await this.#resolveAccessibleChat(String(message.chat), userId);

        this.#toggleReaction(message, userId, emoji);
        const updatedMessage = await ChatMessageModel.findByIdAndUpdate(
            messageId,
            { $set: { reactions: message.reactions } },
            { new: true }
        ).populate('sender');
        if (!updatedMessage) {
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        const persistedMessage = toPersisted(updatedMessage);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'reaction_updated', { chatId, message: persistedMessage });
        return persistedMessage;
    }

    async resolveAccessibleChatTeamId(chatId: string, userId: string): Promise<string> {
        const chat = await this.#resolveAccessibleChat(chatId, userId);
        return String(chat.team);
    }

    async removeUserFromAllChats(userId: string): Promise<void> {
        await ChatModel.updateMany(
            { $or: [{ participants: userId }, { admins: userId }] },
            { $pull: { participants: userId, admins: userId } }
        );

        const orphaned = await ChatModel.find({ participants: { $size: 0 } }).select('_id').lean();
        for (const doc of orphaned) {
            try {
                await this.#deleteChat(String(doc._id));
            } catch (error) {
                logger.warn({ err: error, chatId: String(doc._id), userId }, '@chat/user-deleted: failed to delete empty chat');
            }
        }
    }

    async #createMessage(
        userId: string,
        chatId: string,
        payload: { content: string; messageType: ChatMessageType; metadata?: ChatMessageMetadata }
    ): Promise<ChatView> {
        await this.#resolveAccessibleChat(chatId, userId);

        const message = await ChatMessageModel.create({
            chat: chatId,
            sender: userId,
            content: payload.content,
            messageType: payload.messageType,
            metadata: payload.metadata,
            readBy: [userId],
            reactions: [],
            deleted: false,
            createdAt: new Date()
        });
        await message.populate('sender');

        await ChatModel.findByIdAndUpdate(chatId, { lastMessage: message._id, lastMessageAt: new Date() });

        const persistedMessage = toPersisted(message);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'new_message', { message: persistedMessage, chatId });
        return persistedMessage;
    }

    async #deleteChat(chatId: string): Promise<void> {
        const result = await ChatModel.findByIdAndDelete(chatId);
        if (result) {
            await this.#eventBus.publish(new ChatDeletedEvent({
                chatId,
                teamId: result.team ? String(result.team) : ''
            }));
        }
    }

    async #getChatById(chatId: string): Promise<ChatDoc | null> {
        return ChatModel.findById(chatId);
    }

    async #resolveAccessibleChat(chatId: string, requesterId: string): Promise<ChatDoc> {
        const chat = await this.#getChatById(chatId);
        if (!chat || !chat.isActive) {
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        if (!this.#isParticipant(chat, requesterId)) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'You are not a participant in this chat');
        }
        return chat;
    }

    async #resolveGroupChat(chatId: string, requesterId: string, requireAdmin: boolean): Promise<ChatDoc> {
        const chat = await this.#resolveAccessibleChat(chatId, requesterId);
        if (!chat.isGroup) {
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        if (requireAdmin && !this.#adminIds(chat).includes(requesterId)) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'Only admins can perform this action');
        }
        return chat;
    }

    async #updateChat(chatId: string, data: Record<string, unknown>): Promise<ChatDoc> {
        const updated = await ChatModel.findByIdAndUpdate(chatId, { $set: data }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        return updated;
    }

    async #ensureTeamMembersExist(teamId: string, userIds: string[]): Promise<void> {
        const memberChecks = await Promise.all(
            userIds.map((userId) => this.#teamMemberRepo.findOne({ team: teamId, user: userId }))
        );
        const invalidIndex = memberChecks.findIndex((member) => !member);
        if (invalidIndex !== -1) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, `User ${userIds[invalidIndex]} is not a member of this team`);
        }
    }

    #participantIds(chat: ChatDoc): string[] {
        return (chat.participants as unknown[]).map((participant) => toParticipantId(participant));
    }

    #adminIds(chat: ChatDoc): string[] {
        return (chat.admins as unknown[]).map((admin) => String(admin));
    }

    #isParticipant(chat: ChatDoc, userId: string): boolean {
        return (chat.participants as unknown[]).some((participant) => toParticipantId(participant) === userId);
    }

    #isSender(message: HydratedDocument<ChatMessageDocument>, userId: string): boolean {
        const sender = message.sender as unknown;
        return toParticipantId(sender) === userId;
    }

    #toggleReaction(message: HydratedDocument<ChatMessageDocument>, userId: string, emoji: string): void {
        const reactions = message.reactions;
        for (let i = reactions.length - 1; i >= 0; i--) {
            const reaction = reactions[i];
            const userIndex = reaction.users.findIndex((u) => u.toString() === userId);
            if (userIndex !== -1) {
                reaction.users.splice(userIndex, 1);
                if (reaction.users.length === 0) {
                    reactions.splice(i, 1);
                }
                if (reaction.emoji === emoji) {
                    return;
                }
            }
        }

        const existingReactionIndex = reactions.findIndex((r) => r.emoji === emoji);
        if (existingReactionIndex !== -1) {
            reactions[existingReactionIndex].users.push(userId);
        } else {
            reactions.push({ emoji, users: [userId] });
        }
    }
}
