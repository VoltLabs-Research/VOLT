import type { User } from '@/features/auth/api/types';
import type { Chat, Message } from '@/types/chat';

export interface GetChatsResponse {
    status: string;
    data: Chat[];
};

export interface GetChatMessagesResponse {
    status: string;
    data: Message[];
};

export interface GetTeamMembersResponse {
    status: string;
    data: User[];
};

export interface SendMessageResponse {
    status: string;
    data: Message;
};