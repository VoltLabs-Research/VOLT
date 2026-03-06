import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IChatRepository from '../../domain/port/IChatRepository';
import type { Chat } from '../../domain/entities';
import type { CreateGroupChatDTO, UpdateGroupInfoDTO, UpdateGroupAdminsDTO } from '../../application/dtos/chat';

@injectable()
export default class ChatRepository extends BaseRepository implements IChatRepository {
    constructor() {
        super('/chats', { useRBAC: false });
    }

    async getAll(): Promise<Chat[]> {
        const response = await this.client.get<ApiResponse<Chat[]>>('/');
        return this.unwrap(response);
    }

    async getOrCreate(teamId: string, participantId: string): Promise<Chat> {
        const response = await this.client.get<ApiResponse<Chat>>(
            `/teams/${teamId}/participants/${participantId}`
        );
        return this.unwrap(response);
    }

    async createGroup(dto: CreateGroupChatDTO): Promise<Chat> {
        const response = await this.client.post<ApiResponse<Chat>>('/groups', dto);
        return this.unwrap(response);
    }

    async addUsersToGroup(chatId: string, userIds: string[]): Promise<Chat> {
        const response = await this.client.post<ApiResponse<Chat>>(
            `/${chatId}/groups/add-user`,
            { userIdsToAdd: userIds }
        );
        return this.unwrap(response);
    }

    async removeUsersFromGroup(chatId: string, userIds: string[]): Promise<Chat> {
        const response = await this.client.post<ApiResponse<Chat>>(
            `/${chatId}/groups/remove-users`,
            { userIdsToRemove: userIds }
        );
        return this.unwrap(response);
    }

    async updateGroupInfo(chatId: string, dto: UpdateGroupInfoDTO): Promise<Chat> {
        const response = await this.client.patch<ApiResponse<Chat>>(
            `/${chatId}/groups/info`,
            dto
        );
        return this.unwrap(response);
    }

    async updateGroupAdmins(chatId: string, dto: UpdateGroupAdminsDTO): Promise<Chat> {
        const response = await this.client.patch<ApiResponse<Chat>>(
            `/${chatId}/groups/admins`,
            dto
        );
        return this.unwrap(response);
    }

    async leaveGroup(chatId: string): Promise<void> {
        await this.client.patch(`/${chatId}/groups/leave`);
    }
};
