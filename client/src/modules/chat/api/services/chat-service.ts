import { get, post } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { Chat } from '../entities/chat';
import type { GetOrCreateChatInputDTO } from '../dtos/chat';

const endpoints = {
    getAll: get<EmptyParams, Chat[]>('/'),
    getOrCreate: post<GetOrCreateChatInputDTO, Chat>(
        ({ teamId, participantId }) => `/teams/${teamId}/participants/${participantId}`
    )
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/chats'
        }
    },
    endpoints
});
