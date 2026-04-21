import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
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
import AISDKChatTransport from '@modules/ai/infrastructure/services/AISDKChatTransport';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import { DeleteConversationAITool } from '@modules/ai/application/ai-tools/DeleteConversationAITool';
import { ListConversationsAITool } from '@modules/ai/application/ai-tools/ListConversationsAITool';
import { UpdateConversationAITool } from '@modules/ai/application/ai-tools/UpdateConversationAITool';
import { createClassBindings } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';
import { Lifecycle } from 'tsyringe';

const AI_TOOL_CLASSES = [
    ListConversationsAITool,
    DeleteConversationAITool,
    UpdateConversationAITool
];

export const aiDIManifest: ModuleManifest = {
    name: 'ai',
    singletons: [
        [AI_TOKENS.AIConversationRepository, AIConversationRepository],
        [AI_TOKENS.AIMessageRepository, AIMessageRepository],
        [AI_TOKENS.AIToolService, AIToolService],
        [AI_TOKENS.AIChatTransport, AISDKChatTransport],
        [AI_TOKENS.AIMessageDTOMapper, AIMessageDTOMapper],
        [AI_TOKENS.AIUIMessageUtils, AIUIMessageUtils],
        [AI_TOKENS.AIResponseMessagePartsMapper, AIResponseMessagePartsMapper],
        [AI_TOKENS.CreateAIConversationUseCase, CreateAIConversationUseCase],
        [AI_TOKENS.ListAIConversationsUseCase, ListAIConversationsUseCase],
        [AI_TOKENS.ListAIConversationMessagesUseCase, ListAIConversationMessagesUseCase],
        [AI_TOKENS.SendAIConversationMessageUseCase, SendAIConversationMessageUseCase],
        [AI_TOKENS.UpdateAIConversationUseCase, UpdateAIConversationUseCase],
        [AI_TOKENS.DeleteAIConversationUseCase, DeleteAIConversationUseCase]
    ],
    bindings: [
        ...createClassBindings(AI_TOKENS.AITool, AI_TOOL_CLASSES, Lifecycle.Singleton)
    ]
};
