import { AI_TOKENS } from './AITokens';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import AIResponseMessagePartsMapper from '@modules/ai/utilities/AIResponseMessagePartsMapper';
import AIToolService from '@modules/ai/infrastructure/services/AIToolService';
import AIUIMessageUtils from '@modules/ai/utilities/AIUIMessageUtils';
import CreateAIConversationUseCase from '@modules/ai/application/use-cases/CreateAIConversationUseCase';
import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';
import ListAIConversationMessagesUseCase from '@modules/ai/application/use-cases/ListAIConversationMessagesUseCase';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';
import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import AIProviderModelDiscoveryAdapter from '@modules/ai/infrastructure/services/AIProviderModelDiscoveryAdapter';
import AISDKChatTransport from '@modules/ai/infrastructure/services/AISDKChatTransport';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import { DeleteConversationAITool } from '@modules/ai/application/ai-tools/DeleteConversationAITool';
import { ListConversationsAITool } from '@modules/ai/application/ai-tools/ListConversationsAITool';
import { UpdateConversationAITool } from '@modules/ai/application/ai-tools/UpdateConversationAITool';
import type { AITool } from '@shared/application/ai/AITool';
import { container, Lifecycle } from 'tsyringe';

interface AIToolClassProvider {
    useClass: new (...args: any[]) => AITool;
};

const AI_TOOL_CLASSES: AIToolClassProvider[] = [
    { useClass: ListConversationsAITool },
    { useClass: DeleteConversationAITool },
    { useClass: UpdateConversationAITool }
];

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

    for (const toolClassProvider of AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, { useClass: toolClassProvider.useClass }, {
            lifecycle: Lifecycle.Singleton
        });
    }
};
