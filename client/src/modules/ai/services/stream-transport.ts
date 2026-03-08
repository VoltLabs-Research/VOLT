import TokenStorage from '@/modules/auth/services/token-storage';
import { DefaultChatTransport } from 'ai';
import type {
    CreateConversationStreamTransportParams,
    CreateConversationStreamTransportResult
} from '../api/dtos/create-conversation-stream-transport';

export const createConversationStreamTransport = ({
    teamId,
    conversationId,
    getModelSelection
}: CreateConversationStreamTransportParams): CreateConversationStreamTransportResult => {
    if (!teamId || !conversationId) {
        throw new Error('teamId and conversationId are required to create a stream transport');
    }

    const api = `${import.meta.env.VITE_API_URL}/api/ai/conversations/${teamId}/${conversationId}/messages/stream`;

    return new DefaultChatTransport({
        api,
        headers: () => {
            const token = new TokenStorage().getToken();
            if (!token) {
                const requestHeaders: Record<string, string> = {};
                return requestHeaders;
            }

            return {
                Authorization: `Bearer ${token}`
            };
        },
        body: () => {
            const { provider, model } = getModelSelection();

            return {
                provider,
                model
            };
        },
        prepareSendMessagesRequest: ({ api: requestApi, body, credentials, headers, messages }) => {
            return {
                api: requestApi,
                credentials,
                headers,
                body: {
                    messages,
                    provider: body?.provider,
                    model: body?.model,
                    title: typeof body?.title === 'string' ? body.title : undefined
                }
            };
        }
    });
};
