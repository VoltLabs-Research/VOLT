export interface TypingUser {
    chatId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
}

export enum PresenceStatus {
    Online = 'online',
    Offline = 'offline',
    Unknown = 'unknown'
}
