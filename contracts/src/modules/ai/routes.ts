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

/**
 * Every client-facing ai-conversation endpoint, typed by request/response. Full
 * wire paths under `/api/ai/conversations`, matching the previous
 * `createHttpModule({ basePath: '/api/ai/conversations', teamScope: Param })`
 * verbatim (the team is the first path segment, `:teamId`). `streamMessage`
 * responds with a Server-Sent-Events stream (piped by the controller via
 * `@Res()`), so it carries no typed JSON response body.
 */
export const aiRoutes = {
    listConversations: get<AIConversation>('/api/ai/conversations/:teamId'),
    createConversation: post<CreateAIConversationInput, CreateAIConversationResponse>('/api/ai/conversations/:teamId'),

    listMessages: get<AIMessage>('/api/ai/conversations/:teamId/:conversationId/messages'),
    streamMessage: post<SendAIConversationMessageInput, unknown>('/api/ai/conversations/:teamId/:conversationId/messages/stream'),

    updateConversation: patch<UpdateAIConversationInput, AIConversation>('/api/ai/conversations/:teamId/:conversationId'),
    deleteConversation: del('/api/ai/conversations/:teamId/:conversationId')
} as const;
