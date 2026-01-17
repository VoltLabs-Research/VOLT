import { container } from 'tsyringe';
import { CHAT_TOKENS } from './ChatTokens';
import ChatRepository from '../persistence/mongo/repositories/ChatRepository';
import ChatMessageRepository from '../persistence/mongo/repositories/ChatMessageRepository';

export const registerChatDependencies = () => {
    container.registerSingleton(CHAT_TOKENS.ChatRepository, ChatRepository);
    container.registerSingleton(CHAT_TOKENS.ChatMessageRepository, ChatMessageRepository);
};
