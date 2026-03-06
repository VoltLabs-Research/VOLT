import { container } from 'tsyringe';
import { CHAT_TOKENS } from './tokens';
import ChatRepository from '../repositories/ChatRepository';
import ChatMessageRepository from '../repositories/ChatMessageRepository';
import type IChatRepository from '../../domain/port/IChatRepository';
import type IChatMessageRepository from '../../domain/port/IChatMessageRepository';

export const ensureChatDI = (): void => {
    container.register<IChatRepository>(
        CHAT_TOKENS.ChatRepository,
        ChatRepository
    );
    container.register<IChatMessageRepository>(
        CHAT_TOKENS.ChatMessageRepository,
        ChatMessageRepository
    );
};
