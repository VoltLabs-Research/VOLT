import { createConversationStreamTransport } from '@/modules/ai/services/stream-transport';
import { custom } from '@/app/core/http/utilities/create-service';
import type {
    CreateConversationStreamTransportParams,
    CreateConversationStreamTransportResult
} from '../../dtos/create-conversation-stream-transport';

const endpoints = {
    createStreamTransport: custom<CreateConversationStreamTransportParams, CreateConversationStreamTransportResult>(
        (_ctx, params) => createConversationStreamTransport(params)
    )
};

export default endpoints;
