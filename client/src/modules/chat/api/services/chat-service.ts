import { createService, get, post } from '@/app/core/http/utilities/create-service';

import type { EmptyParams } from '@voltstack/voltclient';
import type { Chat } from '../types/chat';

export interface GetOrCreateChatInput {
    teamId: string;
    participantId: string;
}

const endpoints = {
    getAll: get<EmptyParams, Chat[]>('/'),
    getOrCreate: post<GetOrCreateChatInput, Chat>(
        ({ teamId, participantId }) => `/teams/${teamId}/participants/${participantId}`
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
