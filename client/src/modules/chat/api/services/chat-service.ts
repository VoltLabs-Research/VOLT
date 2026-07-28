import { createService, get, post } from '@/app/core/http/utils/create-service';

import type { EmptyParams } from '@voltstack/voltclient';
import type { Chat } from '@volt/contracts/modules/chat/domain';

export interface GetOrCreateChatInput {
    teamId: string;
    participantId: string;
}

const endpoints = {
    getAll: get<EmptyParams, Chat[]>('/'),
    getOrCreate: post<GetOrCreateChatInput, Chat>('/direct')
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
