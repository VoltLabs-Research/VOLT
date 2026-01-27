import type { Chat, Message } from '../entities';
import type { User } from '@/modules/auth/domain/entities';


export interface IChatRepository {
    getChats(): Promise<Chat[]>;
    getTeamMembers(teamId: string): Promise<User[]>;
    getOrCreateChat(teamId: string, participantId: string): Promise<Chat>;
    getChatMessages(chatId: string, page?: number, limit?: number): Promise<Message[]>;
    sendMessage(chatId: string, content: string, messageType?: string, metadata?: any): Promise<Message>;
    markAsRead(chatId: string): Promise<void>;
    editMessage(chatId: string, messageId: string, content: string): Promise<Message>;
    deleteMessage(chatId: string, messageId: string): Promise<void>;
    getFilePreview(chatId: string, messageId: string): Promise<{ dataUrl: string; fileName: string; fileType: string; fileSize: number }>;
    uploadFile(chatId: string, file: File): Promise<any>;
    createGroupChat(teamId: string, groupName: string, groupDescription: string, participantIds: string[]): Promise<Chat>;
    addUsersToGroup(chatId: string, userIds: string[]): Promise<Chat>;
    removeUserFromGroup(chatId: string, userId: string): Promise<Chat>;
    updateGroupInfo(chatId: string, name: string, description: string): Promise<Chat>;
    updateGroupAdmins(chatId: string, userIds: string[], action: 'add' | 'remove'): Promise<Chat>;
    leaveGroup(chatId: string): Promise<void>;
}
