export const CHAT_TOKENS = {
    ChatRepository: Symbol.for('ChatRepository'),
    ChatMessageRepository: Symbol.for('ChatMessageRepository'),
    SendChatMessageUseCase: Symbol.for('SendChatMessageUseCase'),
    SendFileMessageUseCase: Symbol.for('SendFileMessageUseCase'),
    EditMessageUseCase: Symbol.for('EditMessageUseCase'),
    DeleteMessageUseCase: Symbol.for('DeleteMessageUseCase'),
    ToggleMessageReactionUseCase: Symbol.for('ToggleMessageReactionUseCase'),
    MarkMessagesAsReadUseCase: Symbol.for('MarkMessagesAsReadUseCase'),
    ChatSocketModule: Symbol.for('ChatSocketModule'),
    UploadChatFileUseCase: Symbol.for('UploadChatFileUseCase'),
    GetChatFileUseCase: Symbol.for('GetChatFileUseCase')
};