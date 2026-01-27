import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import VoltClient from '@/shared/infrastructure/api';
import type { ApiResponse } from '@/shared/types/api';
import type { IChatRepository } from '../../domain/repositories/IChatRepository';
import type { Chat, Message } from '../../domain/entities';
import type { User } from '@/modules/auth/domain/entities';

export class ChatRepository extends BaseRepository implements IChatRepository {
    private readonly messagesClient: VoltClient;

    constructor() {
        super('/chats', { useRBAC: false });
        this.messagesClient = new VoltClient('/chat-messages', { useRBAC: false });
    }

    async getChats(): Promise<Chat[]> {
        return this.get<Chat[]>('/');
    }

    async getTeamMembers(teamId: string): Promise<User[]> {
        // We need a specific client here because of the dynamic teamId for RBAC context if we wanted to be strict,
        // but the original code passed getTeamId: () => teamId.
        // We can just create a temporary client or better, use the TeamMemberRepository if we could.
        // For now, preserving logic but cleaning up.
        const tmClient = new VoltClient('/team/members', { useRBAC: true, getTeamId: () => teamId });
        const response = await tmClient.request<any>('get', '/');
        return response.data.data.data.map((member: any) => member.user);
    }

    async getOrCreateChat(teamId: string, participantId: string): Promise<Chat> {
        return this.get<Chat>(`/teams/${teamId}/participants/${participantId}`);
    }

    async getChatMessages(chatId: string, page = 1, limit = 50): Promise<Message[]> {
        const response = await this.messagesClient.request<ApiResponse<{ data: Message[] }>>('get', `/${chatId}/messages`, {
            query: { page, limit }
        });
        return response.data.data.data;
    }

    async sendMessage(chatId: string, content: string, messageType = 'text', metadata?: any): Promise<Message> {
        const response = await this.messagesClient.request<ApiResponse<Message>>('post', `/${chatId}/messages`, {
            data: { content, messageType, metadata }
        });
        return response.data.data;
    }

    async markAsRead(chatId: string): Promise<void> {
        await this.messagesClient.request('patch', `/${chatId}/read`);
    }

    async editMessage(chatId: string, messageId: string, content: string): Promise<Message> {
        const response = await this.messagesClient.request<ApiResponse<Message>>('patch', `/${chatId}/messages/${messageId}`, {
            data: { content }
        });
        return response.data.data;
    }

    async deleteMessage(chatId: string, messageId: string): Promise<void> {
        await this.messagesClient.request('delete', `/${chatId}/messages/${messageId}`);
    }

    async uploadFile(chatId: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.messagesClient.request<ApiResponse<any>>('post', `/${chatId}/upload`, {
            data: formData,
            config: { headers: { 'Content-Type': 'multipart/form-data' } }
        });
        return response.data.data;
    }

    async createGroupChat(teamId: string, groupName: string, groupDescription: string, participantIds: string[]): Promise<Chat> {
        return this.post<Chat>('/groups', { teamId, groupName, groupDescription, participantIds });
    }

    async addUsersToGroup(chatId: string, userIds: string[]): Promise<Chat> {
        return this.post<Chat>(`/groups/${chatId}/users`, { userIds });
    }

    async removeUserFromGroup(chatId: string, userId: string): Promise<Chat> {
        return this.delete<Chat>(`/groups/${chatId}/users/${userId}`);
    }

    async updateGroupInfo(chatId: string, name: string, description: string): Promise<Chat> {
        return this.patch<Chat>(`/groups/${chatId}`, { name, description });
    }

    async updateGroupAdmins(chatId: string, userIds: string[], action: 'add' | 'remove'): Promise<Chat> {
        return this.patch<Chat>(`/groups/${chatId}/admins`, { userIds, action });
    }

    async leaveGroup(chatId: string): Promise<void> {
        await this.post(`/groups/${chatId}/leave`);
    }

    async getFilePreview(_chatId: string, messageId: string): Promise<{ dataUrl: string; fileName: string; fileType: string; fileSize: number }> {
        const response = await this.messagesClient.request<{
            status: 'success';
            data: { dataUrl: string; fileName: string; fileType: string; fileSize: number };
        }>('get', `/files/${messageId}`);
        return response.data.data;
    }
}

export const chatRepository = new ChatRepository();
