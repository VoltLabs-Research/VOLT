import { custom } from '@/app/core/http/utilities/create-service';
import { DefaultChatTransport } from 'ai';
import type { ChatTransport, UIMessage } from 'ai';
import TokenStorage from '@/modules/auth/services/token-storage';
import type { CreateConversationStreamTransportParams } from '../../dtos/create-conversation-stream-transport';

const endpoints = {
    createStreamTransport: custom<CreateConversationStreamTransportParams, ChatTransport<UIMessage>>(
        (_ctx, { teamId, conversationId, getModelSelection }) => {
            const api = teamId && conversationId
                ? `${import.meta.env.VITE_API_URL}/api/ai/conversations/${teamId}/${conversationId}/messages/stream`
                : '/api/ai/conversations/invalid/invalid/messages/stream';

            return new DefaultChatTransport({
                api,
                headers: () => {
                    const token = new TokenStorage().getToken();
                    if (!token) {
                        return {} as Record<string, string>;
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
        }
    )
};

export default endpoints;
