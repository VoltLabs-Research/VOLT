import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';

export const AI_TOKENS = {
    AIConversationRepository: Symbol.for('AIConversationRepository'),
    AIMessageRepository: Symbol.for('AIMessageRepository'),
    AIChatTransport: Symbol.for('AIChatTransport'),
    AIToolService: Symbol.for('AIToolService'),
    AIMessageDTOMapper: Symbol.for('AIMessageDTOMapper'),
    AIUIMessageUtils: Symbol.for('AIUIMessageUtils'),
    AIResponseMessagePartsMapper: Symbol.for('AIResponseMessagePartsMapper'),
    AITool: AI_TOOL_TOKENS.AITool
};
