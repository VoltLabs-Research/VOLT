import { container } from 'tsyringe';
import { AI_TOKENS } from './AITokens';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import AIToolService from '@modules/ai/application/services/AIToolService';
import AIMessageDTOMapper from '@modules/ai/application/services/AIMessageDTOMapper';
import AIUIMessageUtils from '@modules/ai/application/services/AIUIMessageUtils';
import AIResponseMessagePartsMapper from '@modules/ai/application/services/AIResponseMessagePartsMapper';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';
import CreateAIConversationUseCase from '@modules/ai/application/use-cases/CreateAIConversationUseCase';
import ListAIConversationMessagesUseCase from '@modules/ai/application/use-cases/ListAIConversationMessagesUseCase';
import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';
import AISDKChatTransport from '@modules/ai/infrastructure/services/AISDKChatTransport';
import AIProviderModelDiscoveryAdapter from '@modules/ai/infrastructure/services/AIProviderModelDiscoveryAdapter';

import * as aiModuleTools from '@modules/ai/application/ai-tools/index';

export const registerAIDependencies = () => {
    container.registerSingleton(AI_TOKENS.AIConversationRepository, AIConversationRepository);
    container.registerSingleton(AI_TOKENS.AIMessageRepository, AIMessageRepository);
    container.registerSingleton(AI_TOKENS.AIToolService, AIToolService);
    container.registerSingleton(AI_TOKENS.AIChatTransport, AISDKChatTransport);
    container.registerSingleton(AI_TOKENS.AIProviderModelDiscovery, AIProviderModelDiscoveryAdapter);
    container.registerSingleton(AI_TOKENS.AIMessageDTOMapper, AIMessageDTOMapper);
    container.registerSingleton(AI_TOKENS.AIUIMessageUtils, AIUIMessageUtils);
    container.registerSingleton(AI_TOKENS.AIResponseMessagePartsMapper, AIResponseMessagePartsMapper);
    container.registerSingleton(AI_TOKENS.CreateAIConversationUseCase, CreateAIConversationUseCase);
    container.registerSingleton(AI_TOKENS.ListAIConversationsUseCase, ListAIConversationsUseCase);
    container.registerSingleton(AI_TOKENS.ListAIConversationMessagesUseCase, ListAIConversationMessagesUseCase);
    container.registerSingleton(AI_TOKENS.SendAIConversationMessageUseCase, SendAIConversationMessageUseCase);
    container.registerSingleton(AI_TOKENS.UpdateAIConversationUseCase, UpdateAIConversationUseCase);
    container.registerSingleton(AI_TOKENS.DeleteAIConversationUseCase, DeleteAIConversationUseCase);

    for (const ToolClass of Object.values(aiModuleTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
