export const CHAT_TOKENS = {
    ChatRepository: Symbol.for('ChatRepository'),
    ChatMessageRepository: Symbol.for('ChatMessageRepository'),
    SendChatMessageUseCase: Symbol.for('SendChatMessageUseCase'),
    GetTeamMembersUseCase: Symbol.for('GetTeamMembersUseCase'),
    UploadChatFileUseCase: Symbol.for('UploadChatFileUseCase'),
    GetChatFileUseCase: Symbol.for('GetChatFileUseCase')
};