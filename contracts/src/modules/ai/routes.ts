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
    listConversations: get<AIConversation>('/api/ai/conversations/:teamId'),
    createConversation: post<CreateAIConversationInput, CreateAIConversationResponse>('/api/ai/conversations/:teamId'),

    listMessages: get<AIMessage>('/api/ai/conversations/:teamId/:conversationId/messages'),
    streamMessage: post<SendAIConversationMessageInput, unknown>('/api/ai/conversations/:teamId/:conversationId/messages/stream'),

    updateConversation: patch<UpdateAIConversationInput, AIConversation>('/api/ai/conversations/:teamId/:conversationId'),
    deleteConversation: del('/api/ai/conversations/:teamId/:conversationId')
} as const;
