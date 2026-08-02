import { createService, get, post } from '@/app/core/http/utils/create-service';

import type { EmptyParams } from '@voltstack/voltclient';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { GetOrCreateDirectChatInput } from '@volt/contracts/modules/chat/http';

const endpoints = {
    getAll: get<EmptyParams, Chat[]>('/'),
    getOrCreate: post<GetOrCreateDirectChatInput, Chat>('/direct')
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
