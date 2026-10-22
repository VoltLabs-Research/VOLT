import { get, post, patch, del } from '../../shared/routing';
import type { CreateAIConversationInput, UpdateAIConversationInput } from './http';
import type { AIConversation, AIConversationCompacted } from './domain';
import type { AIConversationMessage } from './chat';

export const aiRoutes = {
    listConversations: get<AIConversation>('/api/teams/:teamId/ai-conversations'),
    createConversation: post<CreateAIConversationInput, AIConversation>('/api/teams/:teamId/ai-conversations'),
    getConversation: get<AIConversation>('/api/teams/:teamId/ai-conversations/:conversationId'),
    updateConversation: patch<UpdateAIConversationInput, AIConversation>('/api/teams/:teamId/ai-conversations/:conversationId'),
    deleteConversation: del('/api/teams/:teamId/ai-conversations/:conversationId'),

    // Newest first: the reader cares about the end of a conversation, so page 1 is the latest window.
    listMessages: get<AIConversationMessage>('/api/teams/:teamId/ai-conversations/:conversationId/messages'),
    compactConversation: post<never, AIConversationCompacted>('/api/teams/:teamId/ai-conversations/:conversationId/compact')
} as const;
