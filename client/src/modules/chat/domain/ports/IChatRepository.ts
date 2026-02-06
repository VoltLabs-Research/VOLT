import type { Chat } from '../entities';
import type { CreateGroupChatDTO, UpdateGroupInfoDTO, UpdateGroupAdminsDTO } from '../../application/dtos/chat';

export default interface IChatRepository {
    getAll(): Promise<Chat[]>;
    getOrCreate(teamId: string, participantId: string): Promise<Chat>;
    createGroup(dto: CreateGroupChatDTO): Promise<Chat>;
    addUsersToGroup(chatId: string, userIds: string[]): Promise<Chat>;
    removeUsersFromGroup(chatId: string, userIds: string[]): Promise<Chat>;
    updateGroupInfo(chatId: string, dto: UpdateGroupInfoDTO): Promise<Chat>;
    updateGroupAdmins(chatId: string, dto: UpdateGroupAdminsDTO): Promise<Chat>;
    leaveGroup(chatId: string): Promise<void>;
};
