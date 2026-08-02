import { tokenStorage } from '@/shared/auth/token-storage';
import { buildBackendUrl } from '@/app/core/http/utils/backend-origin';
import { DefaultChatTransport } from 'ai';
import type {
    CreateConversationStreamTransportParams,
    CreateConversationStreamTransportResult
} from '../api/service';

export const createConversationStreamTransport = ({
    teamId,
    conversationId,
    getModelSelection
}: CreateConversationStreamTransportParams): CreateConversationStreamTransportResult => {
    const api = buildBackendUrl(`/api/teams/${teamId}/ai-conversations/${conversationId}/messages`);

    return new DefaultChatTransport({
        api,
        headers: (): Record<string, string> => {
            const token = tokenStorage.getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: getModelSelection,
        prepareSendMessagesRequest: ({ api: requestApi, body, credentials, headers, messages }) => {
            return {
                api: requestApi,
                credentials,
                headers,
                body: {
                    messages,
                    provider: body?.provider,
                    model: body?.model
                }
            };
        }
    });
};
