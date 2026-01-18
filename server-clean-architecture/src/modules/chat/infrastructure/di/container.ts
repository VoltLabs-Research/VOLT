import { container } from 'tsyringe';
import { CHAT_TOKENS } from './ChatTokens';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/ChatRepository';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/ChatMessageRepository';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';
import { SendFileMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendFileMessageUseCase';
import { EditMessageUseCase } from '@modules/chat/application/use-cases/chat-message/EditMessageUseCase';
import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';
import { ToggleMessageReactionUseCase } from '@modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';
import { MarkMessagesAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';

export const registerChatDependencies = () => {
    container.registerSingleton(CHAT_TOKENS.ChatRepository, ChatRepository);
    container.registerSingleton(CHAT_TOKENS.ChatMessageRepository, ChatMessageRepository);
    container.registerSingleton(CHAT_TOKENS.SendChatMessageUseCase, SendChatMessageUseCase);
    container.registerSingleton(CHAT_TOKENS.SendFileMessageUseCase, SendFileMessageUseCase);
    container.registerSingleton(CHAT_TOKENS.EditMessageUseCase, EditMessageUseCase);
    container.registerSingleton(CHAT_TOKENS.DeleteMessageUseCase, DeleteMessageUseCase);
    container.registerSingleton(CHAT_TOKENS.ToggleMessageReactionUseCase, ToggleMessageReactionUseCase);
    container.registerSingleton(CHAT_TOKENS.MarkMessagesAsReadUseCase, MarkMessagesAsReadUseCase);
};
