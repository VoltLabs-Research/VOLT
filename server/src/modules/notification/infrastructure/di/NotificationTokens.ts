interface NotificationTokens {
    readonly NotificationRepository: symbol;
    readonly NotificationSocketModule: symbol;
}

export const NOTIFICATION_TOKENS: NotificationTokens = {
    NotificationRepository: Symbol.for('NotificationRepository'),
    NotificationSocketModule: Symbol.for('NotificationSocketModule')
};
