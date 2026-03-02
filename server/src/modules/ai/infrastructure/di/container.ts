import { container } from 'tsyringe';
import { AI_TOKENS } from './AITokens';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import AIChatOrchestratorService from '@modules/ai/application/services/AIChatOrchestratorService';
import AIToolService from '@modules/ai/application/services/AIToolService';
import AIProviderModelDiscoveryService from '@modules/ai/application/services/AIProviderModelDiscoveryService';
import AIMessageDTOMapper from '@modules/ai/application/services/AIMessageDTOMapper';
import AIUIMessageUtils from '@modules/ai/application/services/AIUIMessageUtils';
import AIResponseMessagePartsMapper from '@modules/ai/application/services/AIResponseMessagePartsMapper';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';

import * as aiModuleTools from '@modules/ai/application/ai-tools/index';

export const registerAIDependencies = () => {
    container.registerSingleton(AI_TOKENS.AIConversationRepository, AIConversationRepository);
    container.registerSingleton(AI_TOKENS.AIMessageRepository, AIMessageRepository);
    container.registerSingleton(AI_TOKENS.AIToolService, AIToolService);
    container.registerSingleton(AI_TOKENS.AIChatOrchestratorService, AIChatOrchestratorService);
    container.registerSingleton(AI_TOKENS.AIProviderModelDiscoveryService, AIProviderModelDiscoveryService);
    container.registerSingleton(AI_TOKENS.AIMessageDTOMapper, AIMessageDTOMapper);
    container.registerSingleton(AI_TOKENS.AIUIMessageUtils, AIUIMessageUtils);
    container.registerSingleton(AI_TOKENS.AIResponseMessagePartsMapper, AIResponseMessagePartsMapper);

    container.register(ListAIConversationsUseCase, { useClass: ListAIConversationsUseCase });

    for (const ToolClass of Object.values(aiModuleTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
