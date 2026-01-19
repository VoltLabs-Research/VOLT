import type { User } from '@/types/models';
import type { Chat, Message } from '@/types/chat';

export interface GetChatsResponse {
    status: string;
    data: Chat[];
};

export interface GetChatMessagesResponse {
    status: string;
    data: {
        data: Message[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
};

export interface GetTeamMembersResponse {
    status: string;
    data: User[];
};

export interface SendMessageResponse {
    status: string;
    data: Message;
};