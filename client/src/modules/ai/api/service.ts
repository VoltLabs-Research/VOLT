import { createConversationStreamTransport } from '@/modules/ai/services/stream-transport';
import { custom, del, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { AIConversation, AIConversationMessage } from './entities/ai-conversation';
import type { CreateAIConversationParams, CreateAIConversationResult } from './dtos/create-ai-conversation';
import type {
    CreateConversationStreamTransportParams,
    CreateConversationStreamTransportResult
} from './dtos/create-conversation-stream-transport';
import type { ListAIConversationMessagesParams } from './dtos/list-ai-conversation-messages';
import type { ListAIConversationsParams } from './dtos/list-ai-conversations';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { UpdateAIConversationParams } from './dtos/update-ai-conversation';

interface ConversationPathParams {
    conversationId: string;
};

type UpdateConversationInput = ConversationPathParams & UpdateAIConversationParams;

type ListMessagesInput = ConversationPathParams & ListAIConversationMessagesParams;

const endpoints = {
    listConversations: paginated<ListAIConversationsParams | undefined, PaginatedResponse<AIConversation>>('/'),
    createConversation: post<CreateAIConversationParams | undefined, CreateAIConversationResult>('/'),
    updateConversation: patch<UpdateConversationInput, AIConversation>('/:conversationId'),
    deleteConversation: del<ConversationPathParams>('/:conversationId'),
    listMessages: paginated<ListMessagesInput, PaginatedResponse<AIConversationMessage>>('/:conversationId/messages'),
    createStreamTransport: custom<CreateConversationStreamTransportParams, CreateConversationStreamTransportResult>(
        (_ctx, params) => createConversationStreamTransport(params)
    )
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/ai/conversations',
            useRBAC: true
        }
    },
    endpoints
});
