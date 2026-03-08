export const AI_TOKENS = {
    AIConversationRepository: Symbol.for('AIConversationRepository'),
    AIMessageRepository: Symbol.for('AIMessageRepository'),
    AIChatTransport: Symbol.for('AIChatTransport'),
    AIProviderModelDiscovery: Symbol.for('AIProviderModelDiscovery'),
    AIToolService: Symbol.for('AIToolService'),
    AIMessageDTOMapper: Symbol.for('AIMessageDTOMapper'),
    AIUIMessageUtils: Symbol.for('AIUIMessageUtils'),
    AIResponseMessagePartsMapper: Symbol.for('AIResponseMessagePartsMapper'),
    CreateAIConversationUseCase: Symbol.for('CreateAIConversationUseCase'),
    ListAIConversationsUseCase: Symbol.for('ListAIConversationsUseCase'),
    ListAIConversationMessagesUseCase: Symbol.for('ListAIConversationMessagesUseCase'),
    SendAIConversationMessageUseCase: Symbol.for('SendAIConversationMessageUseCase'),
    UpdateAIConversationUseCase: Symbol.for('UpdateAIConversationUseCase'),
    DeleteAIConversationUseCase: Symbol.for('DeleteAIConversationUseCase'),
    AITool: Symbol.for('AITool')
} as const;
