import { In } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import { assertAllTeamMembers } from '@modules/team/services/team/team-membership-guard';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { resolveGroupChat } from '@modules/chat/services/chat-access';
import { memberCondition, memberToken } from '@modules/chat/services/chat-member-query';
import logger from '@shared/infrastructure/logger';
import type {
    CreateGroupChatInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput
} from '@volt/contracts/modules/chat/http';

const loadUsersById = async (userIds: string[]): Promise<Map<string, User>> => {
    const uniqueIds = Array.from(new Set(userIds));
    if(uniqueIds.length === 0) return new Map();

    const users = await User.findBy({ id: In(uniqueIds) });
    return new Map(users.map((user) => [user.id, user]));
};

export default class ChatService{
    async getUserChats(userId: string){
        const chats = await Chat.createQueryBuilder('chat')
            .where(memberCondition('participants', 'member'), { member: memberToken(userId) })
            .andWhere('chat.isActive = :isActive', { isActive: true })
            .orderBy('chat.lastMessageAt', 'DESC', 'NULLS LAST')
            .getMany();

        const lastMessageIds = chats.flatMap((chat) => chat.lastMessage ?? []);
        const [participants, lastMessages] = await Promise.all([
            loadUsersById(chats.flatMap((chat) => chat.participants ?? [])),
            lastMessageIds.length === 0
                ? new Map<string, ChatMessage>()
                : ChatMessage.findBy({ id: In(lastMessageIds) })
                    .then((messages) => new Map(messages.map((message) => [message.id, message])))
        ]);

        return chats.map((chat) => ({
            ...chat.toJSON(),
            participants: this.#pickUsers(chat.participants, participants),
            lastMessage: chat.lastMessage === null ? null : lastMessages.get(chat.lastMessage) ?? null
        }));
    }

    async getOrCreateChat(userId: string, targetUserId: string, teamId: string){
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

        return {
            ...chat.toJSON(),
            participants: this.#pickUsers(chat.participants, await loadUsersById(chat.participants ?? []))
        };
    }

    async createGroupChat(userId: string, input: CreateGroupChatInput){
        const { teamId, participantIds, groupName, groupDescription } = input;

        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const allUserIds = [...new Set([userId, ...participantIds])];
        await this.#ensureTeamMembersExist(teamId, allUserIds);

        const chat = await Chat.create({
            participants: allUserIds,
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription,
            admins: [userId],
            createdBy: userId,
            isActive: true
        }).save();

        for(const participantId of allUserIds){
            socketIOEmitter.emitToRoom(`user-${participantId}`, 'group_created', {
                chatId: chat.id,
                createdBy: userId
            });
        }

        return chat.toJSON();
    }

    async addUsersToGroup(userId: string, chatId: string, userIds: string[]){
        const chat = await resolveGroupChat(chatId, userId, true);
        await this.#ensureTeamMembersExist(chat.team, userIds);

        const updatedChat = await this.#updateChat(chatId, {
            participants: Array.from(new Set([...(chat.participants ?? []), ...userIds]))
        });

        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'users_added_to_group', {
            chatId,
            userIds,
            addedBy: userId
        });

        return updatedChat.toJSON();
    }

    async removeUsersFromGroup(userId: string, chatId: string, userIds: string[]){
        const chat = await resolveGroupChat(chatId, userId, true);

        const newParticipants = (chat.participants ?? []).filter((participant) => !userIds.includes(participant));
        if(newParticipants.length < 2){
            throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS, 'The group must have at least 2 members');
        }

        const updatedChat = await this.#updateChat(chatId, {
            participants: newParticipants,
            admins: (chat.admins ?? []).filter((admin) => !userIds.includes(admin))
        });

        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'users_removed_from_group', {
            chatId,
            userIds,
            removedBy: userId
        });

        return updatedChat.toJSON();
    }

    async updateGroupInfo(userId: string, chatId: string, input: UpdateGroupInfoInput){
        await resolveGroupChat(chatId, userId, true);

        const updateData: DeepPartial<Chat> = {};
        if(input.groupName) updateData.groupName = input.groupName;
        if(input.groupDescription) updateData.groupDescription = input.groupDescription;

        const updatedChat = await this.#updateChat(chatId, updateData);

        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'group_info_updated', {
            chatId,
            groupName: input.groupName,
            groupDescription: input.groupDescription,
            updatedBy: userId
        });

        return updatedChat.toJSON();
    }

    async updateGroupAdmins(userId: string, chatId: string, input: UpdateGroupAdminsInput){
        const { action, targetUserIds } = input;
        const chat = await resolveGroupChat(chatId, userId, true);

        const participantIds = chat.participants ?? [];
        if(targetUserIds.some((id) => !participantIds.includes(id))){
            throw ApplicationError.badRequest(ErrorCodes.CHAT_USERS_NOT_IN_TEAM, 'Users not in team');
        }

        const currentAdmins = chat.admins ?? [];
        let updatedAdmins: string[];
        if(action === 'add'){
            updatedAdmins = [...new Set([...currentAdmins, ...targetUserIds])];
        }else if(action === 'remove'){
            updatedAdmins = currentAdmins.filter((admin) => !targetUserIds.includes(admin));
            if(updatedAdmins.length === 0){
                throw ApplicationError.badRequest(ErrorCodes.CHAT_GROUP_MIN_ADMINS, 'At least 1 admin is required');
            }
        }else{
            throw ApplicationError.badRequest(ErrorCodes.CHAT_INVALID_ACTION, 'Invalid group admin action');
        }

        const updatedChat = await this.#updateChat(chatId, { admins: updatedAdmins });
        return updatedChat.toJSON();
    }

    async leaveGroup(userId: string, chatId: string): Promise<void>{
        const chat = await resolveGroupChat(chatId, userId, false);

        const newParticipants = (chat.participants ?? []).filter((participant) => participant !== userId);
        const remainingAdmins = (chat.admins ?? []).filter((admin) => admin !== userId);

        await this.#updateChat(chatId, {
            participants: newParticipants,
            admins: remainingAdmins.length === 0 && chat.createdBy ? [chat.createdBy] : remainingAdmins,
            isActive: newParticipants.length >= 2
        });

        socketIOEmitter.emitToRoom(`chat-${chatId}`, 'user_left_group', {
            chatId,
            userId
        });
    }

    async removeUserFromAllChats(userId: string): Promise<void>{
        const chats = await Chat.createQueryBuilder('chat')
            .where(memberCondition('participants', 'member'), { member: memberToken(userId) })
            .orWhere(memberCondition('admins', 'member'))
            .getMany();

        for(const chat of chats){
            chat.participants = (chat.participants ?? []).filter((participant) => participant !== userId);
            chat.admins = (chat.admins ?? []).filter((admin) => admin !== userId);
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

    async #deleteChat(chatId: string): Promise<void>{
        const chat = await Chat.findOneBy({ id: chatId });
        if(!chat) return;

        const teamId = chat.team;
        await chat.remove();
        await eventBus.emit('chat.deleted', {
            chatId,
            teamId
        });
    }

    async #updateChat(chatId: string, data: DeepPartial<Chat>): Promise<Chat>{
        const chat = await Chat.findOneBy({ id: chatId });
        if(!chat){
            throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
        }
        Object.assign(chat, data);
        return chat.save();
    }

    async #ensureTeamMembersExist(teamId: string, userIds: string[]): Promise<void>{
        // One query for the whole batch: this used to fire an `existsBy` per user.
        await assertAllTeamMembers(teamId, userIds);
    }

    #pickUsers(userIds: string[] | null, users: Map<string, User>): User[]{
        return (userIds ?? [])
            .map((userId) => users.get(userId))
            .filter((user): user is User => user !== undefined);
    }
}
