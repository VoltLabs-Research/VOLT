import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';
import { EditMessageUseCase } from '@modules/chat/application/use-cases/chat-message/EditMessageUseCase';
import { MarkMessageAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';
import { SendFileMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendFileMessageUseCase';
import { ToggleMessageReactionUseCase } from '@modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import ChatSocketAccessPolicy from '@modules/chat/socket/chat/ChatSocketAccessPolicy';
import ChatSocketEventOrchestrator from '@modules/chat/socket/chat/ChatSocketEventOrchestrator';
import ChatSocketModule from '@modules/chat/socket/chat/ChatSocketModule';
import ChatSocketPresenceService from '@modules/chat/socket/chat/ChatSocketPresenceService';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const chatDIManifest: ModuleManifest = {
    name: 'chat',
    singletons: [
        [CHAT_TOKENS.ChatRepository, ChatRepository],
        [CHAT_TOKENS.ChatMessageRepository, ChatMessageRepository],
        [CHAT_TOKENS.SendChatMessageUseCase, SendChatMessageUseCase],
        [CHAT_TOKENS.SendFileMessageUseCase, SendFileMessageUseCase],
        [CHAT_TOKENS.EditMessageUseCase, EditMessageUseCase],
        [CHAT_TOKENS.DeleteMessageUseCase, DeleteMessageUseCase],
        [CHAT_TOKENS.ToggleMessageReactionUseCase, ToggleMessageReactionUseCase],
        [CHAT_TOKENS.MarkMessageAsReadUseCase, MarkMessageAsReadUseCase],
        [CHAT_TOKENS.ChatSocketAccessPolicy, ChatSocketAccessPolicy],
        [CHAT_TOKENS.ChatSocketEventOrchestrator, ChatSocketEventOrchestrator],
        [CHAT_TOKENS.ChatSocketPresenceService, ChatSocketPresenceService],
        [CHAT_TOKENS.ChatSocketModule, ChatSocketModule]
    ],
    aliases: [[SOCKET_TOKENS.SocketModule, CHAT_TOKENS.ChatSocketModule]]
};
