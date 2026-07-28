import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateAIConversationInput,
    UpdateAIConversationInput,
    SendAIConversationMessageInput
} from './http';
import type {
    AIConversation,
    AIMessage,
    CreateAIConversationResponse
} from './domain';

export const aiRoutes = {
    listConversations: get<AIConversation>('/api/teams/:teamId/ai-conversations'),
    createConversation: post<CreateAIConversationInput, CreateAIConversationResponse>('/api/teams/:teamId/ai-conversations'),

    listMessages: get<AIMessage>('/api/teams/:teamId/ai-conversations/:conversationId/messages'),
    streamMessage: post<SendAIConversationMessageInput, unknown>('/api/teams/:teamId/ai-conversations/:conversationId/messages'),

    updateConversation: patch<UpdateAIConversationInput, AIConversation>('/api/teams/:teamId/ai-conversations/:conversationId'),
    deleteConversation: del('/api/teams/:teamId/ai-conversations/:conversationId')
} as const;
