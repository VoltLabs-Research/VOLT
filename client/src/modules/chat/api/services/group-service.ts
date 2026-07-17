import { createService, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { Chat } from '../types/chat';

export interface AddUsersToGroupInput {
    chatId: string;
    userIds: string[];
}

export interface CreateGroupChat {
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
}

export interface RemoveUsersFromGroupInput {
    chatId: string;
    userIds: string[];
}

export interface UpdateGroupAdmins {
    targetUserIds: string[];
    action: 'add' | 'remove';
}

export type UpdateGroupAdminsInput = { chatId: string } & UpdateGroupAdmins;

export interface UpdateGroupInfo {
    groupName?: string;
    groupDescription?: string;
}

export type UpdateGroupInfoInput = { chatId: string } & UpdateGroupInfo;

interface LeaveGroupParams {
    chatId: string;
}

const endpoints = {
    createGroup: post<CreateGroupChat, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupInput, Chat>('/:chatId/users'),
    removeUsersFromGroup: del<RemoveUsersFromGroupInput, Chat>('/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInput, Chat>('/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInput, Chat>('/:chatId/admins'),
    leaveGroup: del<LeaveGroupParams, void>('/:chatId/participants/self', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
