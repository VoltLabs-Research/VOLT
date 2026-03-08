export interface TypingUser {
    chatId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
};

export interface MessagesReadEvent {
    chatId: string;
    readBy: string;
    readAt: string;
};

export enum PresenceStatus {
    Online = 'online',
    Offline = 'offline',
    Unknown = 'unknown'
};
