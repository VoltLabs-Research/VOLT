/**
 * Send message payload.
 */
export interface SendMessagePayload {
    chatId: string;
    content: string;
    messageType: string;
    metadata?: any;
}

/**
 * Send file message payload.
 */
export interface SendFileMessagePayload {
    chatId: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

/**
 * Edit message payload.
 */
export interface EditMessagePayload {
    chatId: string;
    messageId: string;
    content: string;
}

/**
 * Delete message payload.
 */
export interface DeleteMessagePayload {
    chatId: string;
    messageId: string;
}

/**
 * Toggle reaction payload.
 */
export interface ToggleReactionPayload {
    chatId: string;
    messageId: string;
    emoji: string;
}

/**
 * Socket service interface.
 */
export interface ISocketService {
    isConnected(): boolean;
    emit(event: string, data: any): Promise<void>;
    on(event: string, callback: (data: any) => void): () => void;
}

/**
 * Adapter for chat socket operations.
 * Provides typed interface for socket events.
 */
export class ChatSocketAdapter {
    constructor(private readonly socketService: ISocketService) {}

    /**
     * Sends a message via socket.
     */
    async sendMessage(payload: SendMessagePayload): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('send_message', payload);
    }

    /**
     * Sends a file message via socket.
     */
    async sendFileMessage(payload: SendFileMessagePayload): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('send_file_message', payload);
    }

    /**
     * Sends an edit message event.
     */
    async editMessage(payload: EditMessagePayload): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('edit_message', payload);
    }

    /**
     * Sends a delete message event.
     */
    async deleteMessage(payload: DeleteMessagePayload): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('delete_message', payload);
    }

    /**
     * Sends a toggle reaction event.
     */
    async toggleReaction(payload: ToggleReactionPayload): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('toggle_reaction', payload);
    }

    /**
     * Sends a group created event.
     */
    async groupCreated(chatId: string): Promise<void> {
        if (!this.socketService.isConnected()) return;
        await this.socketService.emit('group_created', { chatId });
    }

    /**
     * Checks if socket is connected.
     */
    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    /**
     * Subscribes to message received events.
     */
    onMessageReceived(callback: (message: any) => void): () => void {
        return this.socketService.on('message_received', callback);
    }

    /**
     * Subscribes to message edited events.
     */
    onMessageEdited(callback: (data: { messageId: string; content: string }) => void): () => void {
        return this.socketService.on('message_edited', callback);
    }

    /**
     * Subscribes to message deleted events.
     */
    onMessageDeleted(callback: (data: { messageId: string }) => void): () => void {
        return this.socketService.on('message_deleted', callback);
    }

    /**
     * Subscribes to reaction toggled events.
     */
    onReactionToggled(callback: (data: { messageId: string; reactions: any }) => void): () => void {
        return this.socketService.on('reaction_toggled', callback);
    }
}
