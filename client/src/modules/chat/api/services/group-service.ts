import { createService, post, patch, del } from '@/app/core/http/utils/create-service';

import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatScopedParams } from '@/modules/chat/contracts/api-params';
import type {
    AddUsersToGroupInput,
    CreateGroupChatInput,
    RemoveUsersFromGroupInput,
    UpdateGroupAdminsInput,
    UpdateGroupInfoInput
} from '@volt/contracts/modules/chat/http';

export type AddUsersToGroupParams = ChatScopedParams & AddUsersToGroupInput;

export type CreateGroupChatParams = CreateGroupChatInput;

export type RemoveUsersFromGroupParams = ChatScopedParams & RemoveUsersFromGroupInput;


export type UpdateGroupAdminsParams = ChatScopedParams & UpdateGroupAdminsInput;


export type UpdateGroupInfoParams = ChatScopedParams & UpdateGroupInfoInput;

const endpoints = {
    createGroup: post<CreateGroupChatParams, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupParams, Chat>('/:chatId/users'),
    removeUsersFromGroup: del<RemoveUsersFromGroupParams, Chat>('/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoParams, Chat>('/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsParams, Chat>('/:chatId/admins'),
    leaveGroup: del<ChatScopedParams, void>('/:chatId/participants/self', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
