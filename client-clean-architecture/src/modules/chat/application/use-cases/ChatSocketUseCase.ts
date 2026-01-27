import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class ChatSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    connect(): Promise<void> {
        return this.socketService.connect();
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(listener);
    }

    on<T = any>(event: string, callback: (data: T) => void): () => void {
        return this.socketService.on(event, callback);
    }

    joinChat(chatId: string): void {
        this.emit('join_chat', chatId);
    }

    leaveChat(chatId: string): void {
        this.emit('leave_chat', chatId);
    }

    startTyping(chatId: string): void {
        this.emit('typing_start', { chatId });
    }

    stopTyping(chatId: string): void {
        this.emit('typing_stop', { chatId });
    }

    fetchUsersPresence(userIds: string[]): void {
        this.emit('get_users_presence', { userIds });
    }

    sendMessage(payload: { chatId: string; content: string; messageType?: string; metadata?: any }): void {
        this.emit('send_message', payload);
    }

    sendFileMessage(payload: any): void {
        this.emit('send_file_message', payload);
    }

    editMessage(payload: { chatId: string; messageId: string; content: string }): void {
        this.emit('edit_message', payload);
    }

    deleteMessage(payload: { chatId: string; messageId: string }): void {
        this.emit('delete_message', payload);
    }

    toggleReaction(payload: { chatId: string; messageId: string; emoji: string }): void {
        this.emit('toggle_reaction', payload);
    }

    groupCreated(payload: { chatId: string }): void {
        this.emit('group_created', payload);
    }

    usersAddedToGroup(payload: { chatId: string; userIds: string[] }): void {
        this.emit('users_added_to_group', payload);
    }

    usersRemovedFromGroup(payload: { chatId: string; userId: string }): void {
        this.emit('users_removed_from_group', payload);
    }

    groupInfoUpdated(payload: { chatId: string; name: string; description: string }): void {
        this.emit('group_info_updated', payload);
    }

    userLeftGroup(payload: { chatId: string }): void {
        this.emit('user_left_group', payload);
    }

    private emit(event: string, data: any): void {
        if (!this.socketService.isConnected()) return;
        this.socketService.emit(event, data).catch(() => {});
    }
}
