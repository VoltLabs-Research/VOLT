import { In } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import ChatDeletedEvent from '@modules/chat/events/ChatDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import logger from '@shared/infrastructure/logger';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageMetadata } from '@volt/contracts/modules/chat/domain';
import type { ChatReactionProps } from '@modules/chat/contracts/domain/chat-message';
import type {
    CreateGroupChatInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput,
    SendChatMessageInput
} from '@volt/contracts/modules/chat/http';

type ChatView = Record<string, unknown>;
type ChatPatch = DeepPartial<Chat>;
type MemberColumn = 'participants' | 'admins';

interface ChatMessagesQuery{
    page?: number;
    limit?: number;
}

interface ChatFileData{
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
}

const MESSAGES_DEFAULT_LIMIT = 100;
const LIKE_ESCAPE_CHARACTER = '\\';

const escapeLikePattern = (value: string): string =>
    value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`);

const memberToken = (userId: string): string => `%,${escapeLikePattern(userId)},%`;

const memberCondition = (column: MemberColumn, parameter: string): string =>
    `',' || COALESCE(chat.${column}, '') || ',' LIKE :${parameter} ESCAPE '${LIKE_ESCAPE_CHARACTER}'`;

const toPersisted = (entity: Chat | ChatMessage): ChatView => entity.toJSON();

export default class ChatService{
    #socketEmitter = socketIOEmitter;

    #eventBus = eventBus;

    async getUserChats(userId: string): Promise<ChatView[]>{
        const chats = await Chat.createQueryBuilder('chat')
            .where(memberCondition('participants', 'member'), { member: memberToken(userId) })
            .andWhere('chat.isActive = :isActive', { isActive: true })
            .orderBy('chat.lastMessageAt', 'DESC', 'NULLS LAST')
            .getMany();

        const [participants, lastMessages] = await Promise.all([
            this.#loadUsers(chats.flatMap((chat) => chat.participants ?? [])),
            this.#loadMessages(chats.flatMap((chat) => (chat.lastMessage === null ? [] : [chat.lastMessage])))
        ]);

        return chats.map((chat) => ({
            ...toPersisted(chat),
            participants: this.#resolveUsers(chat.participants, participants),
            lastMessage: this.#resolveLastMessage(chat, lastMessages)
        }));
    }

    async getOrCreateChat(userId: string, targetUserId: string, teamId: string): Promise<ChatView>{
        if(userId === targetUserId){
            throw ApplicationError.badRequest(ErrorCodes.CHAT_INVALID_ACTION, 'Cannot create chat with yourself');
        }

        let chat = await Chat.createQueryBuilder('chat')
            .where(memberCondition('participants', 'requester'), { requester: memberToken(userId) })
            .andWhere(memberCondition('participants', 'target'), { target: memberToken(targetUserId) })
            .andWhere('chat.team = :team', { team: teamId })
            .andWhere('chat.isGroup = :isGroup', { isGroup: false })
            .getOne();

        if(!chat){
            chat = await Chat.create({
                participants: [userId, targetUserId],
                team: teamId,
                isActive: true,
                isGroup: false
            }).save();
        }

        const participants = await this.#loadUsers(chat.participants ?? []);

        return {
            ...toPersisted(chat),
            participants: this.#resolveUsers(chat.participants, participants)
        };
    }

    async createGroupChat(userId: string, input: CreateGroupChatInput): Promise<ChatView>{
        const { teamId, participantIds, groupName, groupDescription } = input;

        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const allUserIds = [...new Set([userId, ...participantIds])];
        await this.#ensureTeamMembersExist(teamId, allUserIds);

        const createdBy = this.#requireGroupCreator(userId);
        const chat = await Chat.create({
            participants: allUserIds,
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription,
            admins: [userId],
            createdBy,
            isActive: true
        }).save();

        for(const participantId of allUserIds){
            this.#socketEmitter.emitToRoom(`user-${participantId}`, 'group_created', {
                chatId: chat.id,
                createdBy: userId
            });
        }

        return toPersisted(chat);
    }

    async addUsersToGroup(userId: string, chatId: string, userIds: string[]): Promise<ChatView>{
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const teamId = chat.team;
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

    async removeUsersFromGroup(userId: string, chatId: string, userIds: string[]): Promise<ChatView>{
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const newParticipants = this.#participantIds(chat).filter((participant) => !userIds.includes(participant));
        if(newParticipants.length < 2){
            throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS, 'The group must have at least 2 members');
        }

        const newAdmins = this.#adminIds(chat).filter((admin) => !userIds.includes(admin));
        const updatedChat = await this.#updateChat(chatId, {
            participants: newParticipants,
            admins: newAdmins
        });

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'users_removed_from_group', {
            chatId,
            userIds,
            removedBy: userId
        });

        return toPersisted(updatedChat);
    }

    async updateGroupInfo(userId: string, chatId: string, input: UpdateGroupInfoInput): Promise<ChatView>{
        await this.#resolveGroupChat(chatId, userId, true);

        const updateData: ChatPatch = {};
        if(input.groupName) updateData.groupName = input.groupName;
        if(input.groupDescription) updateData.groupDescription = input.groupDescription;

        const updatedChat = await this.#updateChat(chatId, updateData);

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'group_info_updated', {
            chatId,
            groupName: input.groupName,
            groupDescription: input.groupDescription,
            updatedBy: userId
        });

        return toPersisted(updatedChat);
    }

    async updateGroupAdmins(userId: string, chatId: string, input: UpdateGroupAdminsInput): Promise<ChatView>{
        const { action, targetUserIds } = input;
        const chat = await this.#resolveGroupChat(chatId, userId, true);

        const participantIds = this.#participantIds(chat);
        const validUsers = targetUserIds.filter((id) => participantIds.includes(id));
        if(validUsers.length !== targetUserIds.length){
            throw ApplicationError.badRequest(ErrorCodes.CHAT_USERS_NOT_IN_TEAM, 'Users not in team');
        }

        let updatedAdmins = [...this.#adminIds(chat)];
        if(action === 'add'){
            updatedAdmins = [...new Set([...updatedAdmins, ...validUsers])];
        }else if(action === 'remove'){
            updatedAdmins = updatedAdmins.filter((admin) => !validUsers.includes(admin));
            if(updatedAdmins.length === 0){
                throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_ADMINS, 'At least 1 admin is required');
            }
        }else{
            throw ApplicationError.badRequest(ErrorCodes.CHAT_INVALID_ACTION, 'Invalid group admin action');
        }

        const updatedChat = await this.#updateChat(chatId, { admins: updatedAdmins });
        return toPersisted(updatedChat);
    }

    async leaveGroup(userId: string, chatId: string): Promise<void>{
        const chat = await this.#resolveGroupChat(chatId, userId, false);

        const newParticipants = this.#participantIds(chat).filter((participant) => participant !== userId);
        let newAdmins = this.#adminIds(chat).filter((admin) => admin !== userId);

        const createdBy = chat.createdBy;
        if(newAdmins.length === 0 && createdBy){
            newAdmins = [createdBy];
        }

        const isActive = newParticipants.length >= 2;
        await this.#updateChat(chatId, {
            participants: newParticipants,
            admins: newAdmins,
            isActive
        });

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'user_left_group', {
            chatId,
            userId
        });
    }

    async getChatMessages(userId: string, chatId: string, query: ChatMessagesQuery): Promise<PaginatedResult<ChatView>>{
        await this.#resolveAccessibleChat(chatId, userId);

        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: MESSAGES_DEFAULT_LIMIT });
        const [messages, total] = await ChatMessage.findAndCount({
            where: { chat: chatId },
            order: { createdAt: 'ASC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest),
            relations: { senderRef: true }
        });

        return paginate([messages.map((message) => toPersisted(message)), total], pageRequest);
    }

    async sendChatMessage(userId: string, chatId: string, input: SendChatMessageInput): Promise<ChatView>{
        return this.#createMessage(userId, chatId, {
            content: input.content,
            messageType: input.messageType as ChatMessageType,
            metadata: input.metadata
        });
    }

    async sendFileMessage(userId: string, chatId: string, fileData: ChatFileData): Promise<ChatView>{
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

    async editMessage(userId: string, chatId: string, messageId: string, content: string): Promise<ChatView>{
        const message = await ChatMessage.findOneBy({ id: messageId });
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }
        if(!this.#isSender(message, userId)){
            throw ApplicationError.forbidden(ErrorCodes.MESSAGE_FORBIDDEN, 'Not owner');
        }

        await Object.assign(message, { content }).save();

        const updatedMessage = await this.#loadMessageWithSender(messageId);
        if(!updatedMessage){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        const persistedMessage = toPersisted(updatedMessage);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'message_edited', {
            chatId,
            message: persistedMessage
        });
        return persistedMessage;
    }

    async deleteMessage(userId: string, chatId: string, messageId: string): Promise<void>{
        const message = await ChatMessage.findOneBy({ id: messageId });
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }
        if(!this.#isSender(message, userId)){
            throw ApplicationError.forbidden(ErrorCodes.MESSAGE_FORBIDDEN, 'Not owner');
        }

        await ChatMessage.update({ id: messageId }, { deleted: true });
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'message_deleted', {
            chatId,
            messageId
        });
    }

    async markMessagesAsRead(userId: string, chatId: string): Promise<void>{
        await this.#resolveAccessibleChat(chatId, userId);

        const messages = await ChatMessage.findBy({ chat: chatId });
        const unread = messages.filter((message) => !this.#readByIds(message).includes(userId));
        for(const message of unread){
            Object.assign(message, { readBy: Array.from(new Set([...this.#readByIds(message), userId])) });
        }
        if(unread.length > 0){
            await ChatMessage.save(unread);
        }

        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'messages_read', {
            chatId,
            readBy: userId,
            readAt: new Date()
        });
    }

    async setMessageReaction(userId: string, chatId: string, messageId: string, emoji: string): Promise<ChatView>{
        return this.#applyReactionChange(userId, chatId, messageId, (reactions) => {
            this.#setReaction(reactions, userId, emoji);
        });
    }

    async removeMessageReaction(userId: string, chatId: string, messageId: string, emoji: string): Promise<ChatView>{
        return this.#applyReactionChange(userId, chatId, messageId, (reactions) => {
            this.#removeReaction(reactions, userId, emoji);
        });
    }

    async #applyReactionChange(
        userId: string,
        chatId: string,
        messageId: string,
        mutate: (reactions: ChatReactionProps[]) => void
    ): Promise<ChatView>{
        const message = await ChatMessage.findOneBy({ id: messageId });
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Message not found');
        }

        await this.#resolveAccessibleChat(message.chat, userId);

        const reactions = (message.reactions ?? []).map((reaction) => ({
            emoji: reaction.emoji,
            users: [...reaction.users]
        }));
        mutate(reactions);
        await Object.assign(message, { reactions }).save();

        const updatedMessage = await this.#loadMessageWithSender(messageId);
        if(!updatedMessage){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        const persistedMessage = toPersisted(updatedMessage);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'reaction_updated', {
            chatId,
            message: persistedMessage
        });
        return persistedMessage;
    }

    async resolveAccessibleChatTeamId(chatId: string, userId: string): Promise<string>{
        const chat = await this.#resolveAccessibleChat(chatId, userId);
        return chat.team;
    }

    async removeUserFromAllChats(userId: string): Promise<void>{
        const chats = await Chat.createQueryBuilder('chat')
            .where(memberCondition('participants', 'member'), { member: memberToken(userId) })
            .orWhere(memberCondition('admins', 'member'))
            .getMany();

        for(const chat of chats){
            Object.assign(chat, {
                participants: this.#participantIds(chat).filter((participant) => participant !== userId),
                admins: this.#adminIds(chat).filter((admin) => admin !== userId)
            });
        }
        if(chats.length > 0){
            await Chat.save(chats);
        }

        const orphaned = await Chat.createQueryBuilder('chat')
            .select('chat.id', 'id')
            .where('chat.participants IS NULL')
            .orWhere('chat.participants = :empty', { empty: '' })
            .getRawMany<{ id: string }>();

        for(const { id } of orphaned){
            try{
                await this.#deleteChat(id);
            }catch(error){
                logger.warn({
                    err: error,
                    chatId: id,
                    userId
                }, '@chat/user-deleted: failed to delete empty chat');
            }
        }
    }

    async #createMessage(
        userId: string,
        chatId: string,
        payload: { content: string; messageType: ChatMessageType; metadata?: ChatMessageMetadata }
    ): Promise<ChatView>{
        await this.#resolveAccessibleChat(chatId, userId);

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

        const message = await this.#loadMessageWithSender(created.id);
        if(!message){
            throw ApplicationError.notFound(ErrorCodes.MESSAGE_NOT_FOUND, 'Chat message not found');
        }

        await Chat.update({ id: chatId }, {
            lastMessage: created.id,
            lastMessageAt: new Date()
        });

        const persistedMessage = toPersisted(message);
        this.#socketEmitter.emitToRoom(`chat-${chatId}`, 'new_message', {
            message: persistedMessage,
            chatId
        });
        return persistedMessage;
    }

    #requireGroupCreator(userId: string): string{
        if(!userId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'A group chat requires a creator');
        }

        return userId;
    }

    async #deleteChat(chatId: string): Promise<void>{
        const chat = await Chat.findOneBy({ id: chatId });
        if(!chat) return;

        const teamId = chat.team;
        await chat.remove();
        await this.#eventBus.publish(new ChatDeletedEvent({
            chatId,
            teamId
        }));
    }

    async #getChatById(chatId: string): Promise<Chat | null>{
        return Chat.findOneBy({ id: chatId });
    }

    async #resolveAccessibleChat(chatId: string, requesterId: string): Promise<Chat>{
        const chat = await this.#getChatById(chatId);
        if(!chat || !chat.isActive){
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        if(!this.#isParticipant(chat, requesterId)){
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'You are not a participant in this chat');
        }
        return chat;
    }

    async #resolveGroupChat(chatId: string, requesterId: string, requireAdmin: boolean): Promise<Chat>{
        const chat = await this.#resolveAccessibleChat(chatId, requesterId);
        if(!chat.isGroup){
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        if(requireAdmin && !this.#adminIds(chat).includes(requesterId)){
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'Only admins can perform this action');
        }
        return chat;
    }

    async #updateChat(chatId: string, data: ChatPatch): Promise<Chat>{
        const chat = await Chat.findOneBy({ id: chatId });
        if(!chat){
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        Object.assign(chat, data);
        return chat.save();
    }

    async #ensureTeamMembersExist(teamId: string, userIds: string[]): Promise<void>{
        const memberChecks = await Promise.all(
            userIds.map((userId) => TeamMember.existsBy({
                team: teamId,
                user: userId
            }))
        );
        const invalidIndex = memberChecks.findIndex((exists) => !exists);
        if(invalidIndex !== -1){
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, `User ${userIds[invalidIndex]} is not a member of this team`);
        }
    }

    async #loadMessageWithSender(messageId: string): Promise<ChatMessage | null>{
        return ChatMessage.findOne({
            where: { id: messageId },
            relations: { senderRef: true }
        });
    }

    async #loadUsers(userIds: string[]): Promise<Map<string, User>>{
        const uniqueIds = Array.from(new Set(userIds));
        if(uniqueIds.length === 0) return new Map();

        const users = await User.findBy({ id: In(uniqueIds) });
        return new Map(users.map((user) => [user.id, user]));
    }

    async #loadMessages(messageIds: string[]): Promise<Map<string, ChatMessage>>{
        const uniqueIds = Array.from(new Set(messageIds));
        if(uniqueIds.length === 0) return new Map();

        const messages = await ChatMessage.findBy({ id: In(uniqueIds) });
        return new Map(messages.map((message) => [message.id, message]));
    }

    #resolveUsers(userIds: string[] | null, users: Map<string, User>): User[]{
        return (userIds ?? [])
            .map((userId) => users.get(userId))
            .filter((user): user is User => user !== undefined);
    }

    #resolveLastMessage(chat: Chat, messages: Map<string, ChatMessage>): ChatMessage | null{
        if(chat.lastMessage === null) return null;
        return messages.get(chat.lastMessage) ?? null;
    }

    #participantIds(chat: Chat): string[]{
        return chat.participants ?? [];
    }

    #adminIds(chat: Chat): string[]{
        return chat.admins ?? [];
    }

    #readByIds(message: ChatMessage): string[]{
        return message.readBy ?? [];
    }

    #isParticipant(chat: Chat, userId: string): boolean{
        return this.#participantIds(chat).includes(userId);
    }

    #isSender(message: ChatMessage, userId: string): boolean{
        return message.sender === userId;
    }

    #setReaction(reactions: ChatReactionProps[], userId: string, emoji: string): void{
        this.#detachUser(reactions, userId, () => true);

        const existingReactionIndex = reactions.findIndex((r) => r.emoji === emoji);
        if(existingReactionIndex !== -1){
            reactions[existingReactionIndex].users.push(userId);
        }else{
            reactions.push({
                emoji,
                users: [userId]
            });
        }
    }

    #removeReaction(reactions: ChatReactionProps[], userId: string, emoji: string): void{
        this.#detachUser(reactions, userId, (reaction) => reaction.emoji === emoji);
    }

    #detachUser(
        reactions: ChatReactionProps[],
        userId: string,
        matches: (reaction: ChatReactionProps) => boolean
    ): void{
        for(let i = reactions.length - 1; i >= 0; i--){
            const reaction = reactions[i];
            if(!matches(reaction)){
                continue;
            }

            const userIndex = reaction.users.findIndex((u) => u.toString() === userId);
            if(userIndex === -1){
                continue;
            }

            reaction.users.splice(userIndex, 1);
            if(reaction.users.length === 0){
                reactions.splice(i, 1);
            }
        }
    }
}
