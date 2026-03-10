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
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';
import type { ClassProvider } from 'tsyringe';
import { container, Lifecycle } from 'tsyringe';

const AI_TOOL_CLASSES: ClassProvider<unknown>[] = [
    { useClass: ListConversationsAITool },
    { useClass: DeleteConversationAITool },
    { useClass: UpdateConversationAITool }
];

export const registerAIDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [AI_TOKENS.AIConversationRepository, AIConversationRepository],
            [AI_TOKENS.AIMessageRepository, AIMessageRepository],
            [AI_TOKENS.AIToolService, AIToolService],
            [AI_TOKENS.AIChatTransport, AISDKChatTransport],
            [AI_TOKENS.AIProviderModelDiscovery, AIProviderModelDiscoveryAdapter],
            [AI_TOKENS.AIMessageDTOMapper, AIMessageDTOMapper],
            [AI_TOKENS.AIUIMessageUtils, AIUIMessageUtils],
            [AI_TOKENS.AIResponseMessagePartsMapper, AIResponseMessagePartsMapper],
            [AI_TOKENS.CreateAIConversationUseCase, CreateAIConversationUseCase],
            [AI_TOKENS.ListAIConversationsUseCase, ListAIConversationsUseCase],
            [AI_TOKENS.ListAIConversationMessagesUseCase, ListAIConversationMessagesUseCase],
            [AI_TOKENS.SendAIConversationMessageUseCase, SendAIConversationMessageUseCase],
            [AI_TOKENS.UpdateAIConversationUseCase, UpdateAIConversationUseCase],
            [AI_TOKENS.DeleteAIConversationUseCase, DeleteAIConversationUseCase]
        ]
    });

    for (const toolClassProvider of AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, { useClass: toolClassProvider.useClass }, {
            lifecycle: Lifecycle.Singleton
        });
    }
};
