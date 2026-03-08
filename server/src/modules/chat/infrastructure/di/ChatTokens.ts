export const CHAT_TOKENS = Object.freeze({
    ChatRepository: Symbol.for('ChatRepository'),
    ChatMessageRepository: Symbol.for('ChatMessageRepository'),
    SendChatMessageUseCase: Symbol.for('SendChatMessageUseCase'),
    SendFileMessageUseCase: Symbol.for('SendFileMessageUseCase'),
    EditMessageUseCase: Symbol.for('EditMessageUseCase'),
    DeleteMessageUseCase: Symbol.for('DeleteMessageUseCase'),
    ToggleMessageReactionUseCase: Symbol.for('ToggleMessageReactionUseCase'),
    MarkMessageAsReadUseCase: Symbol.for('MarkMessageAsReadUseCase'),
    MarkMessagesAsReadUseCase: Symbol.for('MarkMessageAsReadUseCase'),
    ChatSocketModule: Symbol.for('ChatSocketModule'),
    ChatSocketAccessPolicy: Symbol.for('ChatSocketAccessPolicy'),
    ChatSocketEventOrchestrator: Symbol.for('ChatSocketEventOrchestrator'),
    ChatSocketPresenceService: Symbol.for('ChatSocketPresenceService')
});