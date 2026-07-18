import { CHAT_CONTRACT_TOKENS } from '@shared/contracts/tokens/ChatTokens';

export const CHAT_TOKENS = Object.freeze({
    ChatService: Symbol.for('ChatService'),
    ChatRepository: CHAT_CONTRACT_TOKENS.ChatRepository,
    ChatMessageRepository: Symbol.for('ChatMessageRepository')
});
