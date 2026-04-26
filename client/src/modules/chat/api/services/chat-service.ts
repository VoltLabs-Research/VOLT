import { createService, get, post } from '@/app/core/http/utilities/create-service';

import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { Chat } from '../entities/chat';
import type { GetOrCreateChatInputDTO } from '../dtos/chat';

const endpoints = {
    getAll: get<EmptyParams, Chat[]>('/'),
    getOrCreate: post<GetOrCreateChatInputDTO, Chat>(
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
