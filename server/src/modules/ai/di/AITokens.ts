import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';

export const AI_TOKENS = {
    AIChatTransport: Symbol.for('AIChatTransport'),
    AIToolService: Symbol.for('AIToolService'),
    AIUIMessageUtils: Symbol.for('AIUIMessageUtils'),
    AIResponseMessagePartsMapper: Symbol.for('AIResponseMessagePartsMapper'),
    AITool: AI_TOOL_TOKENS.AITool
};
